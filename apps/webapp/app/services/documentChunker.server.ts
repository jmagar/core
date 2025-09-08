import { encode } from "gpt-tokenizer";
import crypto from "crypto";

export interface DocumentChunk {
  content: string;
  chunkIndex: number;
  title?: string;
  context?: string;
  startPosition: number;
  endPosition: number;
  contentHash: string; // Hash for change detection
}

export interface ChunkedDocument {
  documentId: string;
  title: string;
  originalContent: string;
  chunks: DocumentChunk[];
  totalChunks: number;
  contentHash: string; // Hash of the entire document
  chunkHashes: string[]; // Array of chunk hashes for change detection
}

/**
 * Document chunking service that splits large documents into semantic chunks
 * Targets 1-3k tokens per chunk for better entity extraction with natural paragraph boundaries
 */
export class DocumentChunker {
  private readonly TARGET_CHUNK_SIZE = 3000; // Much smaller for better entity extraction
  private readonly MIN_CHUNK_SIZE = 1000;
  private readonly MAX_CHUNK_SIZE = 5000;
  private readonly MIN_PARAGRAPH_SIZE = 100; // Minimum tokens for a paragraph to be considered

  /**
   * Chunk a document into semantic sections with natural boundaries
   */
  async chunkDocument(
    originalContent: string,
    title: string,
  ): Promise<ChunkedDocument> {
    const documentId = crypto.randomUUID();
    const contentHash = this.generateContentHash(originalContent);
    
    // First, split by major section headers (markdown style)
    const majorSections = this.splitByMajorSections(originalContent);
    
    const chunks: DocumentChunk[] = [];
    let currentChunk = "";
    let currentChunkStart = 0;
    let chunkIndex = 0;

    for (const section of majorSections) {
      const sectionTokens = encode(section.content).length;
      const currentChunkTokens = encode(currentChunk).length;
      
      // If adding this section would exceed max size, finalize current chunk
      if (currentChunkTokens > 0 && currentChunkTokens + sectionTokens > this.MAX_CHUNK_SIZE) {
        if (currentChunkTokens >= this.MIN_CHUNK_SIZE) {
          chunks.push(this.createChunk(
            currentChunk,
            chunkIndex,
            currentChunkStart,
            currentChunkStart + currentChunk.length,
            section.title
          ));
          chunkIndex++;
          currentChunk = "";
          currentChunkStart = section.startPosition;
        }
      }
      
      // Add section to current chunk
      if (currentChunk) {
        currentChunk += "\n\n" + section.content;
      } else {
        currentChunk = section.content;
        currentChunkStart = section.startPosition;
      }
      
      // If current chunk is large enough and we have a natural break, consider chunking
      const updatedChunkTokens = encode(currentChunk).length;
      if (updatedChunkTokens >= this.TARGET_CHUNK_SIZE) {
        // Try to find a good breaking point within the section
        const paragraphs = this.splitIntoParagraphs(section.content);
        if (paragraphs.length > 1) {
          // Split at paragraph boundary if beneficial
          const optimalSplit = this.findOptimalParagraphSplit(currentChunk);
          if (optimalSplit) {
            chunks.push(this.createChunk(
              optimalSplit.beforeSplit,
              chunkIndex,
              currentChunkStart,
              currentChunkStart + optimalSplit.beforeSplit.length,
              section.title
            ));
            chunkIndex++;
            currentChunk = optimalSplit.afterSplit;
            currentChunkStart = currentChunkStart + optimalSplit.beforeSplit.length;
          }
        }
      }
    }
    
    // Add remaining content as final chunk
    if (currentChunk.trim() && encode(currentChunk).length >= this.MIN_PARAGRAPH_SIZE) {
      chunks.push(this.createChunk(
        currentChunk,
        chunkIndex,
        currentChunkStart,
        originalContent.length
      ));
    }

    // Generate chunk hashes array
    const chunkHashes = chunks.map(chunk => chunk.contentHash);

    return {
      documentId,
      title,
      originalContent,
      chunks,
      totalChunks: chunks.length,
      contentHash,
      chunkHashes,
    };
  }

  private splitByMajorSections(content: string): Array<{
    content: string;
    title?: string;
    startPosition: number;
    endPosition: number;
  }> {
    const sections: Array<{
      content: string;
      title?: string;
      startPosition: number;
      endPosition: number;
    }> = [];

    // Split by markdown headers (# ## ### etc.) or common document patterns
    const headerRegex = /^(#{1,6}\s+.*$|={3,}$|-{3,}$)/gm;
    const matches = Array.from(content.matchAll(headerRegex));
    
    if (matches.length === 0) {
      // No headers found, treat as single section
      sections.push({
        content: content.trim(),
        startPosition: 0,
        endPosition: content.length,
      });
      return sections;
    }

    let lastIndex = 0;
    
    for (let i = 0; i < matches.length; i++) {
      const match = matches[i];
      const nextMatch = matches[i + 1];
      
      const sectionStart = lastIndex;
      const sectionEnd = nextMatch ? nextMatch.index! : content.length;
      
      const sectionContent = content.slice(sectionStart, sectionEnd).trim();
      
      if (sectionContent) {
        sections.push({
          content: sectionContent,
          title: this.extractSectionTitle(match[0]),
          startPosition: sectionStart,
          endPosition: sectionEnd,
        });
      }
      
      lastIndex = match.index! + match[0].length;
    }

    return sections;
  }

  private extractSectionTitle(header: string): string | undefined {
    // Extract title from markdown header
    const markdownMatch = header.match(/^#{1,6}\s+(.+)$/);
    if (markdownMatch) {
      return markdownMatch[1].trim();
    }
    return undefined;
  }

  private splitIntoParagraphs(content: string): string[] {
    // Split by double newlines (paragraph breaks) and filter out empty strings
    return content
      .split(/\n\s*\n/)
      .map(p => p.trim())
      .filter(p => p.length > 0);
  }

  private findOptimalParagraphSplit(content: string): {
    beforeSplit: string;
    afterSplit: string;
  } | null {
    const paragraphs = this.splitIntoParagraphs(content);
    if (paragraphs.length < 2) return null;

    let bestSplitIndex = -1;
    let bestScore = 0;

    // Find the split that gets us closest to target size
    for (let i = 1; i < paragraphs.length; i++) {
      const beforeSplit = paragraphs.slice(0, i).join("\n\n");
      const afterSplit = paragraphs.slice(i).join("\n\n");
      
      const beforeTokens = encode(beforeSplit).length;
      const afterTokens = encode(afterSplit).length;
      
      // Score based on how close we get to target, avoiding too small chunks
      if (beforeTokens >= this.MIN_CHUNK_SIZE && afterTokens >= this.MIN_PARAGRAPH_SIZE) {
        const beforeDistance = Math.abs(beforeTokens - this.TARGET_CHUNK_SIZE);
        const score = 1 / (1 + beforeDistance); // Higher score for closer to target
        
        if (score > bestScore) {
          bestScore = score;
          bestSplitIndex = i;
        }
      }
    }

    if (bestSplitIndex > 0) {
      return {
        beforeSplit: paragraphs.slice(0, bestSplitIndex).join("\n\n"),
        afterSplit: paragraphs.slice(bestSplitIndex).join("\n\n"),
      };
    }

    return null;
  }

  private createChunk(
    content: string,
    chunkIndex: number,
    startPosition: number,
    endPosition: number,
    title?: string
  ): DocumentChunk {
    // Generate a concise context/title if not provided
    const context = title || this.generateChunkContext(content);
    const contentHash = this.generateContentHash(content.trim());
    
    return {
      content: content.trim(),
      chunkIndex,
      title: context,
      context: `Chunk ${chunkIndex + 1}${context ? `: ${context}` : ""}`,
      startPosition,
      endPosition,
      contentHash,
    };
  }

  private generateChunkContext(content: string): string {
    // Extract first meaningful line as context (avoiding markdown syntax)
    const lines = content.split('\n').map(line => line.trim()).filter(Boolean);
    
    for (const line of lines.slice(0, 3)) {
      // Skip markdown headers and find first substantial content
      if (!line.match(/^#{1,6}\s/) && !line.match(/^[=-]{3,}$/) && line.length > 10) {
        return line.substring(0, 100) + (line.length > 100 ? "..." : "");
      }
    }
    
    return "Document content";
  }

  /**
   * Generate content hash for change detection
   */
  private generateContentHash(content: string): string {
    return crypto.createHash('sha256').update(content, 'utf8').digest('hex').substring(0, 16);
  }

  /**
   * Compare chunk hashes to detect changes
   */
  static compareChunkHashes(oldHashes: string[], newHashes: string[]): {
    changedIndices: number[];
    changePercentage: number;
  } {
    const maxLength = Math.max(oldHashes.length, newHashes.length);
    const changedIndices: number[] = [];

    for (let i = 0; i < maxLength; i++) {
      const oldHash = oldHashes[i];
      const newHash = newHashes[i];
      
      // Mark as changed if hash is different or chunk added/removed
      if (oldHash !== newHash) {
        changedIndices.push(i);
      }
    }

    const changePercentage = maxLength > 0 ? (changedIndices.length / maxLength) * 100 : 0;
    
    return {
      changedIndices,
      changePercentage,
    };
  }

  /**
   * Calculate document size in tokens for threshold decisions
   */
  static getDocumentSizeInTokens(content: string): number {
    return encode(content).length;
  }
}