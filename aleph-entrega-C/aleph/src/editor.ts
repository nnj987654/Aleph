export interface EditorBlock {
  id: string;
  type: 'heading' | 'paragraph' | 'list' | 'code' | 'quote';
  level?: number;
  content: string;
  indent: number;
  children: EditorBlock[];
}

export class BlockEditor {
  private blocks: EditorBlock[] = [];
  private selectedBlockId: string | null = null;

  constructor(initialBlocks?: EditorBlock[]) {
    this.blocks = initialBlocks || [];
  }

  addBlock(block: EditorBlock, parentId?: string): void {
    if (!parentId) {
      this.blocks.push(block);
    } else {
      const parent = this.findBlock(parentId);
      if (parent) {
        parent.children.push(block);
      }
    }
  }

  updateBlock(id: string, content: string): void {
    const block = this.findBlock(id);
    if (block) {
      block.content = content;
    }
  }

  deleteBlock(id: string): void {
    this.blocks = this.blocks.filter(b => b.id !== id);
  }

  indentBlock(id: string): void {
    const block = this.findBlock(id);
    if (block && block.indent < 4) {
      block.indent++;
    }
  }

  dedentBlock(id: string): void {
    const block = this.findBlock(id);
    if (block && block.indent > 0) {
      block.indent--;
    }
  }

  changeBlockType(id: string, type: EditorBlock['type'], level?: number): void {
    const block = this.findBlock(id);
    if (block) {
      block.type = type;
      block.level = level;
    }
  }

  selectBlock(id: string): void {
    this.selectedBlockId = id;
  }

  getSelectedBlock(): EditorBlock | null {
    return this.selectedBlockId ? this.findBlock(this.selectedBlockId) : null;
  }

  private findBlock(id: string, blocks = this.blocks): EditorBlock | null {
    for (const block of blocks) {
      if (block.id === id) return block;
      const found = this.findBlock(id, block.children);
      if (found) return found;
    }
    return null;
  }

  getBlocks(): EditorBlock[] {
    return this.blocks;
  }

  setBlocks(blocks: EditorBlock[]): void {
    this.blocks = blocks;
  }
}
