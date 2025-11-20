import * as zmq from 'zeromq';

// 常量定义（与其他组件保持一致）
const ROUTER_ADDRESS = "tcp://127.0.0.1:5555";
// const ROUTER_ADDRESS = "ipc:///tmp/pubsub.ipc";
const CLIENT_IDENTITY = "client"; // 客户端固定标识

// 打印消息辅助函数（用于调试）
function printMessage(prefix: string, msg: Buffer[]) {
    console.log(`[${prefix}] 消息帧数量: ${msg.length}`);
    msg.forEach((frame, i) => {
        console.log(`  帧${i}: ${JSON.stringify(frame.toString())}`);
    });
}

// 定义类型：保存Dealer实例和关闭方法
type DealerHandle = {
  dealer: zmq.Dealer;
  abort: () => void;
};

/**
 * 启动Dealer并返回关闭句柄
 */
/**
 * 启动终端RPC Dealer（支持注册/注销）
 */
async function startTerminalRpcDealer(
  identity: string,
  dealerCallBack: (command: string) => Promise<string>
): Promise<DealerHandle> {
  const dealer = new zmq.Dealer();
  dealer.routingId = identity;

  const abortController = new AbortController();
  const { signal } = abortController;

  await dealer.connect(ROUTER_ADDRESS);
  console.log(`Dealer [${identity}] 已启动，连接到 Router: ${ROUTER_ADDRESS}`);
  
  // 发送注册消息（携带空工程路径，与Router逻辑对齐）
  const registerMsg: Buffer[] = [
    Buffer.from(""), // 空帧（Dealer-Router协议要求）
    Buffer.from("REGISTER"),
    Buffer.from("") // 工程路径（当前函数无path参数，传空）
  ];
  await dealer.send(registerMsg);
  console.log(`Dealer [${identity}] 已发送注册请求`);

  // 消息接收循环
  (async () => {
    try {
      for await (const msg of dealer) {
        if (signal.aborted) break;

        printMessage(`Dealer ${identity} 收到`, msg);
        if (msg.length < 3) {
          console.log(`Dealer ${identity} 收到无效消息格式，跳过处理`);
          continue;
        }

        // 处理注册确认
        if (msg[2].toString() === "REGISTERED") {
          console.log(`Dealer ${identity} 注册成功`);
          continue;
        }

        const clientId = msg[1];
        const requestContent = msg[2];
        const response = await dealerCallBack(requestContent.toString());

        const reply: Buffer[] = [
          Buffer.from(""),
          clientId,
          Buffer.from(response)
        ];
        await dealer.send(reply);
        printMessage(`Dealer ${identity} 发送响应`, reply);
      }
    } catch (err) {
      if (!signal.aborted) {
        console.error(`Dealer ${identity} 异常退出:`, err);
      }
    } finally {
      // 循环退出后关闭套接字（注销消息已在closeDealer中发送）
      if (!dealer.closed) {
        await dealer.close();
        console.log(`Dealer [${identity}] 套接字已关闭`);
      }
    }
  })();

  return {
    dealer,
    abort: () => abortController.abort()
  };
}

/**
 * 启动终端管理Dealer（支持注册/注销，补充关闭句柄）
 */
async function startTerminalMgtDealer(
  identity: string,
  path: string,
  dealerCallBack: (command: string) => Promise<string>
): Promise<DealerHandle> { // 改为返回DealerHandle，支持关闭
  const dealer = new zmq.Dealer();
  dealer.routingId = identity;

  const abortController = new AbortController();
  const { signal } = abortController;

  await dealer.connect(ROUTER_ADDRESS);
  console.log(`Dealer [${identity}] 已启动，连接到 Router: ${ROUTER_ADDRESS}`);

  // 发送注册消息（携带工程路径）
  const registerMsg: Buffer[] = [
    Buffer.from(""),
    Buffer.from("REGISTER"),
    Buffer.from(path)
  ];
  await dealer.send(registerMsg);
  console.log(`Dealer [${identity}] 已发送注册请求（工程路径：${path}）`);

  // 消息接收循环
  (async () => {
    try {
      for await (const msg of dealer) {
        if (signal.aborted) break;

        printMessage(`Dealer ${identity} 收到`, msg);
        if (msg.length < 3) {
          console.log(`Dealer ${identity} 收到无效消息格式，跳过处理`);
          continue;
        }

        // 处理注册确认
        if (msg[2].toString() === "REGISTERED") {
          console.log(`Dealer ${identity} 注册成功`);
          continue;
        }

        const clientId = msg[1];
        const requestContent = msg[2];
        const response = await dealerCallBack(requestContent.toString());

        const reply: Buffer[] = [
          Buffer.from(""),
          clientId,
          Buffer.from(response)
        ];
        await dealer.send(reply);
        printMessage(`Dealer ${identity} 发送响应`, reply);
      }
    } catch (err) {
      if (!signal.aborted) {
        console.error(`Dealer ${identity} 异常退出:`, err);
      }
    } finally {
      // 循环退出后关闭套接字
      if (!dealer.closed) {
        await dealer.close();
        console.log(`Dealer [${identity}] 套接字已关闭`);
      }
    }
  })();

  // 返回关闭句柄
  return {
    dealer,
    abort: () => abortController.abort()
  };
}

/**
 * 关闭Dealer（发送UNREGISTER消息后关闭）
 */
async function closeDealer(handle: DealerHandle): Promise<void> {
  const { dealer, abort } = handle;
  if (dealer.closed) {
    console.log("Dealer已关闭，无需重复操作");
    return;
  }

  try {
    // 1. 发送UNREGISTER注销消息（符合Dealer-Router协议格式）
    const unregisterMsg: Buffer[] = [
      Buffer.from(""), // 空帧
      Buffer.from("UNREGISTER") // 注销命令
    ];
    await dealer.send(unregisterMsg);
    console.log(`Dealer [${dealer.routingId}] 已发送注销请求`);
  } catch (err) {
    console.error(`Dealer [${dealer.routingId}] 发送注销消息失败:`, err);
  }

  // 2. 触发循环终止
  abort();

  // 3. 确保套接字关闭
  if (!dealer.closed) {
    await dealer.close();
    console.log(`Dealer [${dealer.routingId}] 已强制关闭`);
  }
}

export {
    startTerminalRpcDealer,
    startTerminalMgtDealer,
    DealerHandle,
    closeDealer
}