/**
 * @fileoverview Visual Editor Block ID injection utility
 * @author Tutors Alliance Scotland Development Team
 * @version 1.0.0
 * @since 2024-01-01
 *
 * @description Utility script for injecting unique block IDs into HTML elements:
 * - Scans all HTML files in the public directory
 * - Adds data-ve-block-id attributes to editable elements
 * - Supports h1-h6, p, img, and a tags
 * - Skips navigation elements to prevent conflicts
 *
 * @requires jsdom for HTML parsing
 * @requires uuid for unique ID generation
 * @performance Processes files in batch for efficiency
 */

import { JSDOM } from 'jsdom';
import { v4 as uuid } from 'uuid';
import fs from 'fs/promises';
import path from 'path';

async function glob(dir, ext = '.html', files = []) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      await glob(fullPath, ext, files);
    } else if (entry.isFile() && entry.name.endsWith(ext)) {
      files.push(fullPath);
    }
  }
  return files;
}

const publicDir = path.resolve('public');
const EDITABLE_TAGS = ['h1','h2','h3','h4','h5','h6','p','img','a'];

(async () => {
  const files = await glob(publicDir);
  for (const file of files) {
    const html = await fs.readFile(file, 'utf8');
    const dom = new JSDOM(html);
    const doc = dom.window.document;
    let changed = 0;
    EDITABLE_TAGS.forEach(tag => {
      doc.querySelectorAll(tag).forEach(el => {
        if (!el.closest('.main-nav') && !el.dataset.veBlockId) {
          el.setAttribute('data-ve-block-id', uuid());
          changed++;
        }
      });
    });
    if (changed > 0) {
      await fs.writeFile(file, dom.serialize());
      console.log(`[inject-ve-block-ids] ${file}: injected ${changed} data-ve-block-id attributes.`);
    }
  }
})(); 