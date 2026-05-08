import * as vscode from 'vscode';

interface ContentMark {
    line : number,
    char : number
}

const INTERNAL_MARK_ID = 0;
const EXTERNAL_MARK_ID = 1;

// 预编译ANSI转义序列正则表达式，避免在saveLine中重复创建
const ANSI_ESCAPE_REGEX = /\x1B\[[0-?]*[ -/]*[@-~]/g;

/**
 * 从VS Code设置中获取终端滚动缓冲区行数
 * @returns 滚动缓冲区行数，默认1000行
 */
function getScrollbackLines(): number {
    const config = vscode.workspace.getConfiguration('terminal.integrated');
    const scrollback = config.get<number>('scrollback', 1000);
    return Math.max(1, scrollback);
}

function processBackspaces(str: string): string {
  const chars: string[] = []; // 用数组存储有效字符

  for (const char of str) {
    if (char === '\x08') { // \x08 是退格符的转义表示（等价于\08）
      // 若数组不为空，删除最后一个有效字符（模拟退格）
      if (chars.length > 0) {
        chars.pop();
      }
    } else {
      // 非退格符，直接加入数组
      chars.push(char);
    }
  }

  return chars.join('');
}

export class TerminalContentBuffer {
  private history: string[];
  private _maxLines: number; // 用私有变量存储，通过getter暴露
  private _firstLine: number;
  private _curPos: number;
  private _marker: ContentMark[];
  private _lastline: string;

  //private _markerPos: number;
  //private _markerPosInLine: number;
  //private _userMarkerPos: number;
  //private _userMarkerPosInLine: number;

  /**
   * 创建终端内容缓冲区
   * @param maxLines 最大行数，默认为VS Code设置中的terminal.integrated.scrollback值
   */
  constructor(maxLines: number = getScrollbackLines()) {
    if (maxLines < 1 || maxLines>65535) {
      throw new Error("最大行数必须大于0且小于65536行");
    }
    this._maxLines = maxLines;
    this.clear();
  }

  /**
   * 获取当前最大行数配置
   */
  get maxLines(): number {
    return this._maxLines;
  }

  /**
   * 动态修改最大行数配置
   * @param newMaxLines 新的最大行数（必须大于0）
   */
  set maxLines(newMaxLines: number) {
    if (newMaxLines < 1 || newMaxLines>65535) {
      throw new Error("最大行数必须大于0且小于65536行");
    }
    // 仅当新值与旧值不同时才处理，避免无效操作
    if (newMaxLines === this._maxLines) return;

    this._maxLines = newMaxLines;
    
    // 清空当前记录
    this.clear();
  }

   /**
   * 保存终端响应行
   * @param line 终端输出的单行字符串
   */
  saveLine(line: string, newline: boolean): void {
    // 使用预编译的正则表达式，避免重复创建
    
    this._lastline += line;
    
    //如果到达最后一行，回到0
    if (!newline) {
        return;
    }

    //一行处理结束时替换其中的ASNI转义序列和BS字符
    this.history[this._curPos] = processBackspaces(this._lastline.replace(ANSI_ESCAPE_REGEX, ''));
    this._lastline = "";

    this._curPos += 1;
    if (this._curPos >= this._maxLines) {
        this._curPos = 0;
    }
    this.history[this._curPos] = "";

    //处理翻转情况
    if (this._curPos === this._firstLine) {
        this._firstLine += 1;
        if (this._firstLine >= this._maxLines) {
            this._firstLine = 0;
        }
    }

    for (const mark of this._marker) {
        if (this._curPos === mark.line) {
            mark.line += 1;
            if (mark.line >= this._maxLines) {
                mark.line = 0;
            }
        }
    }
  }

  saveContent(content: string): void {
    const lines : string[] = content.split('\n');
    if (lines.length>1) {
        for (const line of lines.slice(0, lines.length-1)) {
            this.saveLine(line, true);
        }
    }
    this.saveLine(lines[lines.length-1], false);
  }

  /**
   * 记录当前最后一行的位置
   */
  _setMarker(index: number): void {
    this._marker[index].line = this._curPos;
    if (this.history[this._curPos]) {
        this._marker[index].char = this.history[this._curPos].length;
    }
    else {
        this._marker[index].char = 0;
    }
  }

  _resetMarker(index: number): void {
    this._marker[index].line = -1;
    this._marker[index].char = 0;
  }

  setInternalMark(): void {
    this._setMarker(INTERNAL_MARK_ID);
  }
  resetInternalMark(): void {
    this._resetMarker(INTERNAL_MARK_ID);
  }

  setExternalMark(): void {
    this._setMarker(EXTERNAL_MARK_ID);
  }

  resetExternalMark(): void {
    this._resetMarker(EXTERNAL_MARK_ID);
  }
  
  /**
   * 从最新行开始获取指定行数的信息
   * @param count 需要获取的行数，默认为1
   * @returns 拼接后的字符串（每行以换行符分隔）
   */
  getLatestLines(count: number = 1): string {
    if (count < 1) {
      //throw new Error("获取行数必须大于0");
      return "";
    }

    //未出现翻转，直接从当前位置向前取指定个数
    if (this._curPos >= this._firstLine) {
        const startIndex = Math.max(this._firstLine, this._curPos - count);
        return this.history.slice(startIndex, this._curPos).join('\n');  
    }

    //出现了翻转时，如果获取的个数小于当前位置，直接返回指定行数的信息
    if (count <= this._curPos) {
        return this.history.slice( this._curPos - count, this._curPos).join('\n');    
    }

    //出现了翻转并且需要进行拼接
    const part1 = this.history.slice(0, this._curPos).join('\n');
    const startIndex = Math.max(this._firstLine, this._maxLines-(count - (this._curPos)));
    const part2 = this.history.slice(startIndex).join('\n');

    return part2 + "\n" + part1;
  }

  _getMarkedLines(index: number): string {
    const markedLine = this.history[this._marker[index].line].slice(this._marker[index].char);
    if (this._marker[index].line  <= this._curPos) {
        return markedLine + "\n" + this.history.slice(this._marker[index].line + 1, this._curPos + 1).join('\n');
    }

    const part1 = this.history.slice(this._marker[index].line + 1).join('\n');
    const part2 = this.history.slice(0, this._curPos + 1).join('\n');
    return markedLine + "\n" +  part1 + "\n" + part2;
  }

  getInternalMarkedLines() : string {
   return this._getMarkedLines(INTERNAL_MARK_ID) ;
  }

  getExternalMarkedLines() : string {
   return this._getMarkedLines(EXTERNAL_MARK_ID) ;
  }

  /**
   * 获取当前保存的总行数
   */
  getLineCount(): number {
    if (this._curPos < this._firstLine) {
        return this._maxLines;
    }
    return this._curPos;
  }

  /**
   * 清空历史记录（可选辅助方法）
   */
  clear(): void {
    this.history = [];
    this._firstLine = 0;
    this._curPos = 0;
    this._lastline = "";
    /*this._markerPos = -1;
    this._markerPosInLine = 0;
    this._userMarkerPos = -1;
    this._userMarkerPosInLine = 0;*/
    this._marker = [];
    this._marker[0] = {line: -1, char: 0};
    this._marker[1] = {line: -1, char: 0};
  }
}