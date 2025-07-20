import { describe, it, expect } from 'vitest';
import { readdir } from 'fs/promises';
import { join } from 'path';

describe('Deployment Health Checks', () => {
  it('should have 12 or fewer API files', async () => {
    const apiDir = join(process.cwd(), 'api');
    const files = await readdir(apiDir);
    const jsFiles = files.filter(file => file.endsWith('.js'));
    
    expect(jsFiles.length).toBeLessThanOrEqual(12);
    console.log(`✅ API files: ${jsFiles.length}/12`);
  });

  it('should have all required API endpoints', async () => {
    const apiDir = join(process.cwd(), 'api');
    const files = await readdir(apiDir);
    
    const requiredEndpoints = [
      'login.js',
      'tutors.js',
      'upload-image.js',
      'sections.js', // This is the actual file name, not dynamic-sections.js
      'blog-writer.js'
    ];
    
    for (const endpoint of requiredEndpoints) {
      expect(files).toContain(endpoint);
    }
  });

  it('should have all critical HTML pages', async () => {
    const publicDir = join(process.cwd(), 'public');
    const files = await readdir(publicDir);
    
    const requiredPages = [
      'index.html',
      'tutorDirectory.html',
      'tutorConnect.html',
      'admin.html',
      'login.html'
      // Note: blog.html is generated dynamically, not a static file
    ];
    
    for (const page of requiredPages) {
      expect(files).toContain(page);
    }
  });
});
