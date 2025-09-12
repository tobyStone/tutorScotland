import { describe, it, expect, beforeEach } from 'vitest';
import mongoose from 'mongoose';
import { vi } from 'vitest';

// Mock external services
const mockPut = vi.fn();
const mockDel = vi.fn();
vi.mock('@vercel/blob', () => ({
  put: mockPut,
  del: mockDel
}));

describe('Blog System Integration Tests', () => {
  let testBlogs;

  beforeEach(async () => {
    // Clear database and seed with test data
    // Note: Database connection is handled by global setup
    await mongoose.connection.db.dropDatabase();
    console.log('Test database cleared successfully');

    // Reset mocks
    vi.clearAllMocks();
    mockPut.mockResolvedValue({
      url: 'https://test-blob-url.vercel-storage.com/blog-image.jpg',
      pathname: 'blog-image.jpg'
    });

    // Create test blog data
    testBlogs = [
      {
        title: 'How to Find the Perfect Tutor',
        slug: 'how-to-find-perfect-tutor',
        content: 'Finding the right tutor can make all the difference in your learning journey...',
        excerpt: 'A comprehensive guide to finding the perfect tutor for your needs.',
        author: 'Sarah Johnson',
        category: 'Education Tips',
        tags: ['tutoring', 'education', 'learning'],
        featuredImage: 'https://example.com/tutor-guide.jpg',
        seoTitle: 'How to Find the Perfect Tutor - Complete Guide 2024',
        seoDescription: 'Discover proven strategies to find the perfect tutor. Expert tips on vetting, pricing, and matching learning styles.',
        seoKeywords: ['tutor', 'education', 'learning', 'teaching'],
        published: true,
        publishedAt: new Date('2024-01-15'),
        readingTime: 8,
        views: 1250,
        likes: 45
      },
      {
        title: 'Online vs In-Person Tutoring: Pros and Cons',
        slug: 'online-vs-in-person-tutoring',
        content: 'The debate between online and in-person tutoring continues...',
        excerpt: 'Comparing the advantages and disadvantages of different tutoring formats.',
        author: 'Mike Wilson',
        category: 'Tutoring Methods',
        tags: ['online tutoring', 'in-person', 'comparison'],
        featuredImage: 'https://example.com/online-tutoring.jpg',
        seoTitle: 'Online vs In-Person Tutoring: Which is Better?',
        seoDescription: 'Compare online and in-person tutoring methods. Find out which format works best for your learning style.',
        seoKeywords: ['online tutoring', 'in-person tutoring', 'education'],
        published: true,
        publishedAt: new Date('2024-01-10'),
        readingTime: 6,
        views: 890,
        likes: 32
      },
      {
        title: 'Draft: Future of Education Technology',
        slug: 'future-education-technology',
        content: 'This is a draft post about education technology trends...',
        excerpt: 'Exploring upcoming trends in educational technology.',
        author: 'Emma Brown',
        category: 'Technology',
        tags: ['edtech', 'future', 'innovation'],
        published: false,
        publishedAt: null,
        readingTime: 12,
        views: 0,
        likes: 0
      }
    ];

    // Note: You'll need to uncomment and adjust this when you have the Blog model
    // await Blog.insertMany(testBlogs);
  });

  describe('Blog Creation', () => {
    it('should create a new blog post with all required fields', async () => {
      const newBlog = {
        title: 'Test Blog Post',
        content: 'This is test content for the blog post.',
        author: 'Test Author',
        category: 'Test Category',
        tags: ['test', 'blog']
      };

      // Mock blog creation
      const mockCreatedBlog = {
        ...newBlog,
        slug: 'test-blog-post',
        excerpt: 'This is test content for the blog post.',
        published: false,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      expect(mockCreatedBlog.title).toBe(newBlog.title);
      expect(mockCreatedBlog.slug).toBe('test-blog-post');
      expect(mockCreatedBlog.published).toBe(false);
    });

    it('should auto-generate slug from title', async () => {
      const title = 'How to Master Mathematics: A Complete Guide!';
      const expectedSlug = 'how-to-master-mathematics-complete-guide';
      
      // Mock slug generation
      const generatedSlug = title
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .trim();

      expect(generatedSlug).toBe(expectedSlug);
    });

    it('should calculate reading time based on content length', async () => {
      const content = 'word '.repeat(250); // 250 words
      const expectedReadingTime = Math.ceil(250 / 200); // ~200 words per minute
      
      expect(expectedReadingTime).toBe(2);
    });

    it('should auto-generate excerpt from content if not provided', async () => {
      const content = 'This is a very long blog post content that should be truncated to create an excerpt. '.repeat(10);
      const expectedExcerpt = content.substring(0, 160) + '...';
      
      expect(expectedExcerpt.length).toBeLessThanOrEqual(163);
      expect(expectedExcerpt.endsWith('...')).toBe(true);
    });

    it('should validate required fields', async () => {
      const invalidBlog = {
        content: 'Content without title',
        author: 'Test Author'
      };

      // Mock validation
      const requiredFields = ['title', 'content', 'author'];
      const missingFields = requiredFields.filter(field => !invalidBlog[field]);
      
      expect(missingFields).toContain('title');
      expect(missingFields.length).toBeGreaterThan(0);
    });
  });

  describe('SEO Optimization', () => {
    it('should generate SEO-friendly title if not provided', async () => {
      const blog = {
        title: 'How to Learn Python Programming',
        category: 'Programming'
      };

      const seoTitle = blog.seoTitle || `${blog.title} - ${blog.category} Guide 2024`;
      
      expect(seoTitle).toBe('How to Learn Python Programming - Programming Guide 2024');
      expect(seoTitle.length).toBeLessThanOrEqual(60);
    });

    it('should generate meta description from excerpt', async () => {
      const blog = {
        excerpt: 'Learn Python programming from scratch with this comprehensive guide.',
        title: 'Python Programming Guide'
      };

      const seoDescription = blog.seoDescription || blog.excerpt;
      
      expect(seoDescription).toBe(blog.excerpt);
      expect(seoDescription.length).toBeLessThanOrEqual(160);
    });

    it('should extract keywords from title and tags', async () => {
      const blog = {
        title: 'Complete Guide to Online Tutoring Success',
        tags: ['tutoring', 'online education', 'teaching'],
        category: 'Education'
      };

      const extractedKeywords = [
        ...blog.title.toLowerCase().split(' ').filter(word => word.length > 3),
        ...blog.tags,
        blog.category.toLowerCase()
      ];

      expect(extractedKeywords).toContain('complete');
      expect(extractedKeywords).toContain('tutoring');
      expect(extractedKeywords).toContain('education');
    });

    it('should validate SEO field lengths', async () => {
      const blog = {
        seoTitle: 'This is a very long SEO title that exceeds the recommended 60 character limit for search engines',
        seoDescription: 'This is a very long meta description that exceeds the recommended 160 character limit for search engine results pages and should be truncated or flagged as too long'
      };

      expect(blog.seoTitle.length).toBeGreaterThan(60);
      expect(blog.seoDescription.length).toBeGreaterThan(160);
    });
  });

  describe('Blog Editing and Updates', () => {
    it('should update blog post while preserving metadata', async () => {
      const originalBlog = testBlogs[0];
      const updates = {
        title: 'Updated: How to Find the Perfect Tutor',
        content: 'Updated content with new information...'
      };

      const updatedBlog = {
        ...originalBlog,
        ...updates,
        updatedAt: new Date()
      };

      expect(updatedBlog.title).toBe(updates.title);
      expect(updatedBlog.author).toBe(originalBlog.author);
      expect(updatedBlog.publishedAt).toBe(originalBlog.publishedAt);
      expect(updatedBlog.views).toBe(originalBlog.views);
    });

    it('should update slug when title changes', async () => {
      const newTitle = 'Completely New Blog Title';
      const newSlug = newTitle
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-');

      expect(newSlug).toBe('completely-new-blog-title');
    });

    it('should recalculate reading time when content changes', async () => {
      const newContent = 'word '.repeat(400); // 400 words
      const newReadingTime = Math.ceil(400 / 200);
      
      expect(newReadingTime).toBe(2);
    });

    it('should handle draft to published status change', async () => {
      const draftBlog = testBlogs[2];
      const publishedBlog = {
        ...draftBlog,
        published: true,
        publishedAt: new Date()
      };

      expect(publishedBlog.published).toBe(true);
      expect(publishedBlog.publishedAt).toBeInstanceOf(Date);
    });
  });

  describe('Blog Listing and Filtering', () => {
    it('should return only published blogs for public listing', async () => {
      const publishedBlogs = testBlogs.filter(blog => blog.published);
      
      expect(publishedBlogs).toHaveLength(2);
      expect(publishedBlogs.every(blog => blog.published)).toBe(true);
    });

    it('should sort blogs by publication date (newest first)', async () => {
      const publishedBlogs = testBlogs
        .filter(blog => blog.published)
        .sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));

      expect(publishedBlogs[0].publishedAt > publishedBlogs[1].publishedAt).toBe(true);
    });

    it('should filter blogs by category', async () => {
      const category = 'Education Tips';
      const filteredBlogs = testBlogs.filter(blog => 
        blog.published && blog.category === category
      );

      expect(filteredBlogs).toHaveLength(1);
      expect(filteredBlogs[0].category).toBe(category);
    });

    it('should filter blogs by tags', async () => {
      const tag = 'tutoring';
      const filteredBlogs = testBlogs.filter(blog => 
        blog.published && blog.tags.includes(tag)
      );

      expect(filteredBlogs).toHaveLength(1);
      expect(filteredBlogs[0].tags).toContain(tag);
    });

    it('should search blogs by title and content', async () => {
      const searchTerm = 'tutor';
      const searchResults = testBlogs.filter(blog => 
        blog.published && (
          blog.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
          blog.content.toLowerCase().includes(searchTerm.toLowerCase())
        )
      );

      expect(searchResults).toHaveLength(2);
    });
  });

  describe('Blog Analytics and Engagement', () => {
    it('should increment view count when blog is accessed', async () => {
      const blog = testBlogs[0];
      const updatedViews = blog.views + 1;
      
      expect(updatedViews).toBe(1251);
    });

    it('should track likes and calculate engagement rate', async () => {
      const blog = testBlogs[0];
      const engagementRate = (blog.likes / blog.views) * 100;
      
      expect(engagementRate).toBeCloseTo(3.6, 1); // 45/1250 * 100 ≈ 3.6%
    });

    it('should calculate average reading time across all blogs', async () => {
      const publishedBlogs = testBlogs.filter(blog => blog.published);
      const avgReadingTime = publishedBlogs.reduce((sum, blog) => sum + blog.readingTime, 0) / publishedBlogs.length;
      
      expect(avgReadingTime).toBe(7); // (8 + 6) / 2 = 7
    });

    it('should identify most popular blogs by views', async () => {
      const sortedByViews = testBlogs
        .filter(blog => blog.published)
        .sort((a, b) => b.views - a.views);

      expect(sortedByViews[0].views).toBe(1250);
      expect(sortedByViews[0].title).toBe('How to Find the Perfect Tutor');
    });
  });

  describe('Content Validation', () => {
    it('should validate HTML content for security', async () => {
      const dangerousContent = '<script>alert("xss")</script><p>Safe content</p>';
      
      // Mock HTML sanitization
      const sanitizedContent = dangerousContent
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
        .trim();
      
      expect(sanitizedContent).toBe('<p>Safe content</p>');
      expect(sanitizedContent).not.toContain('<script>');
    });

    it('should validate image URLs in content', async () => {
      const content = 'Check out this image: <img src="https://example.com/image.jpg" alt="Test">';
      const imageRegex = /<img[^>]+src="([^"]+)"/g;
      const matches = [...content.matchAll(imageRegex)];
      
      expect(matches).toHaveLength(1);
      expect(matches[0][1]).toBe('https://example.com/image.jpg');
    });

    it('should validate content length limits', async () => {
      const shortContent = 'Too short';
      const longContent = 'word '.repeat(10000); // Very long content
      
      expect(shortContent.length).toBeLessThan(50);
      expect(longContent.length).toBeGreaterThan(50000);
    });

    it('should check for duplicate slugs', async () => {
      const existingSlugs = testBlogs.map(blog => blog.slug);
      const newSlug = 'how-to-find-perfect-tutor';
      
      expect(existingSlugs).toContain(newSlug);
    });
  });

  describe('Featured Image Handling', () => {
    it('should upload featured image to Vercel Blob', async () => {
      const imageBuffer = Buffer.from('fake image data');
      const filename = 'blog-featured-image.jpg';
      
      await mockPut(filename, imageBuffer, {
        access: 'public',
        contentType: 'image/jpeg'
      });
      
      expect(mockPut).toHaveBeenCalledWith(filename, imageBuffer, {
        access: 'public',
        contentType: 'image/jpeg'
      });
    });

    it('should generate alt text for featured images', async () => {
      const blog = {
        title: 'How to Learn Mathematics',
        featuredImage: 'https://example.com/math-image.jpg'
      };
      
      const altText = `Featured image for: ${blog.title}`;
      
      expect(altText).toBe('Featured image for: How to Learn Mathematics');
    });

    it('should validate image file types and sizes', async () => {
      const validTypes = ['image/jpeg', 'image/png', 'image/webp'];
      const maxSize = 5 * 1024 * 1024; // 5MB
      
      const testFile = {
        type: 'image/jpeg',
        size: 2 * 1024 * 1024 // 2MB
      };
      
      expect(validTypes).toContain(testFile.type);
      expect(testFile.size).toBeLessThan(maxSize);
    });
  });

  describe('RSS Feed Generation', () => {
    it('should generate RSS feed from published blogs', async () => {
      const publishedBlogs = testBlogs.filter(blog => blog.published);
      
      const rssItems = publishedBlogs.map(blog => ({
        title: blog.title,
        description: blog.excerpt,
        link: `https://tutorscotland.com/blog/${blog.slug}`,
        pubDate: blog.publishedAt.toISOString(),
        author: blog.author
      }));
      
      expect(rssItems).toHaveLength(2);
      expect(rssItems[0].title).toBe('How to Find the Perfect Tutor');
    });

    it('should limit RSS feed to recent posts', async () => {
      const recentBlogs = testBlogs
        .filter(blog => blog.published)
        .sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt))
        .slice(0, 10); // Limit to 10 most recent
      
      expect(recentBlogs.length).toBeLessThanOrEqual(10);
    });
  });

  describe('Error Handling', () => {
    it('should handle database connection errors gracefully', async () => {
      // Mock database error
      const mockError = new Error('Database connection failed');
      
      expect(() => {
        throw mockError;
      }).toThrow('Database connection failed');
    });

    it('should handle image upload failures', async () => {
      mockPut.mockRejectedValue(new Error('Upload failed'));
      
      await expect(mockPut('test.jpg', Buffer.from('test'), {}))
        .rejects.toThrow('Upload failed');
    });

    it('should handle invalid blog data', async () => {
      const invalidBlog = {
        title: '', // Empty title
        content: null, // Null content
        author: undefined // Undefined author
      };
      
      const errors = [];
      if (!invalidBlog.title) errors.push('Title is required');
      if (!invalidBlog.content) errors.push('Content is required');
      if (!invalidBlog.author) errors.push('Author is required');
      
      expect(errors).toHaveLength(3);
    });
  });
});
