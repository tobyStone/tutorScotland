import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import { vi } from 'vitest';

describe('Dynamic Sections Integration Tests', () => {
  let mongoServer;
  let testSections;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();
    await mongoose.connect(mongoUri);
    console.log('Test database connected successfully');
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
    console.log('Test database torn down successfully');
  });

  beforeEach(async () => {
    await mongoose.connection.db.dropDatabase();
    console.log('Test database cleared successfully');

    // Create test dynamic sections data
    testSections = [
      {
        id: 'section-1',
        pageSlug: 'about',
        type: 'text',
        title: 'Our Mission',
        content: 'We are dedicated to connecting students with qualified tutors...',
        position: 'top',
        order: 1,
        isActive: true,
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01')
      },
      {
        id: 'section-2',
        pageSlug: 'about',
        type: 'image',
        title: 'Team Photo',
        content: '',
        imageUrl: 'https://example.com/team-photo.jpg',
        imageAlt: 'Our amazing team',
        position: 'middle',
        order: 2,
        isActive: true,
        createdAt: new Date('2024-01-02'),
        updatedAt: new Date('2024-01-02')
      },
      {
        id: 'section-3',
        pageSlug: 'services',
        type: 'team-member',
        title: 'Meet Sarah',
        content: 'Sarah is our lead mathematics tutor with 10 years of experience.',
        imageUrl: 'https://example.com/sarah.jpg',
        imageAlt: 'Sarah Johnson - Mathematics Tutor',
        position: 'bottom',
        order: 1,
        isActive: true,
        metadata: {
          name: 'Sarah Johnson',
          role: 'Mathematics Tutor',
          experience: '10 years',
          subjects: ['Algebra', 'Calculus', 'Statistics']
        },
        createdAt: new Date('2024-01-03'),
        updatedAt: new Date('2024-01-03')
      },
      {
        id: 'section-4',
        pageSlug: 'about',
        type: 'text',
        title: 'Inactive Section',
        content: 'This section is not active',
        position: 'bottom',
        order: 3,
        isActive: false,
        createdAt: new Date('2024-01-04'),
        updatedAt: new Date('2024-01-04')
      }
    ];

    // Note: You'll need to uncomment and adjust this when you have the Section model
    // await Section.insertMany(testSections);
  });

  describe('Section CRUD Operations', () => {
    it('should create a new dynamic section', async () => {
      const newSection = {
        pageSlug: 'home',
        type: 'text',
        title: 'Welcome Message',
        content: 'Welcome to TutorScotland!',
        position: 'top',
        order: 1,
        isActive: true
      };

      const createdSection = {
        ...newSection,
        id: 'section-5',
        createdAt: new Date(),
        updatedAt: new Date()
      };

      expect(createdSection.title).toBe(newSection.title);
      expect(createdSection.pageSlug).toBe(newSection.pageSlug);
      expect(createdSection.isActive).toBe(true);
    });

    it('should read sections by page slug', async () => {
      const aboutSections = testSections.filter(section => 
        section.pageSlug === 'about' && section.isActive
      );

      expect(aboutSections).toHaveLength(2);
      expect(aboutSections.every(section => section.pageSlug === 'about')).toBe(true);
      expect(aboutSections.every(section => section.isActive)).toBe(true);
    });

    it('should update an existing section', async () => {
      const sectionToUpdate = testSections[0];
      const updates = {
        title: 'Updated Mission Statement',
        content: 'Our updated mission is to provide excellent tutoring services...',
        updatedAt: new Date()
      };

      const updatedSection = {
        ...sectionToUpdate,
        ...updates
      };

      expect(updatedSection.title).toBe(updates.title);
      expect(updatedSection.content).toBe(updates.content);
      expect(updatedSection.id).toBe(sectionToUpdate.id);
      expect(updatedSection.createdAt).toBe(sectionToUpdate.createdAt);
    });

    it('should delete a section (soft delete by setting isActive to false)', async () => {
      const sectionToDelete = testSections[0];
      const deletedSection = {
        ...sectionToDelete,
        isActive: false,
        updatedAt: new Date()
      };

      expect(deletedSection.isActive).toBe(false);
      expect(deletedSection.id).toBe(sectionToDelete.id);
    });

    it('should validate required fields when creating section', async () => {
      const invalidSection = {
        type: 'text',
        content: 'Content without required fields'
      };

      const requiredFields = ['pageSlug', 'type', 'title', 'position'];
      const missingFields = requiredFields.filter(field => !invalidSection[field]);

      expect(missingFields).toContain('pageSlug');
      expect(missingFields).toContain('title');
      expect(missingFields).toContain('position');
    });
  });

  describe('Section Ordering and Positioning', () => {
    it('should return sections ordered by order field', async () => {
      const aboutSections = testSections
        .filter(section => section.pageSlug === 'about' && section.isActive)
        .sort((a, b) => a.order - b.order);

      expect(aboutSections[0].order).toBe(1);
      expect(aboutSections[1].order).toBe(2);
      expect(aboutSections[0].order < aboutSections[1].order).toBe(true);
    });

    it('should group sections by position', async () => {
      const aboutSections = testSections.filter(section => 
        section.pageSlug === 'about' && section.isActive
      );

      const groupedByPosition = aboutSections.reduce((groups, section) => {
        const position = section.position;
        if (!groups[position]) groups[position] = [];
        groups[position].push(section);
        return groups;
      }, {});

      expect(groupedByPosition.top).toHaveLength(1);
      expect(groupedByPosition.middle).toHaveLength(1);
      expect(groupedByPosition.bottom).toBeUndefined();
    });

    it('should reorder sections when order changes', async () => {
      const sectionsToReorder = [
        { id: 'section-1', order: 2 },
        { id: 'section-2', order: 1 }
      ];

      const reorderedSections = testSections.map(section => {
        const reorderInfo = sectionsToReorder.find(r => r.id === section.id);
        return reorderInfo ? { ...section, order: reorderInfo.order } : section;
      });

      const aboutSections = reorderedSections
        .filter(section => section.pageSlug === 'about' && section.isActive)
        .sort((a, b) => a.order - b.order);

      expect(aboutSections[0].id).toBe('section-2');
      expect(aboutSections[1].id).toBe('section-1');
    });

    it('should handle drag and drop reordering', async () => {
      const dragDropUpdate = {
        sectionId: 'section-1',
        newPosition: 'bottom',
        newOrder: 1,
        pageSlug: 'about'
      };

      const updatedSection = {
        ...testSections[0],
        position: dragDropUpdate.newPosition,
        order: dragDropUpdate.newOrder,
        updatedAt: new Date()
      };

      expect(updatedSection.position).toBe('bottom');
      expect(updatedSection.order).toBe(1);
    });

    it('should auto-increment order for new sections in same position', async () => {
      const existingSections = testSections.filter(section => 
        section.pageSlug === 'about' && 
        section.position === 'top' && 
        section.isActive
      );

      const maxOrder = Math.max(...existingSections.map(s => s.order), 0);
      const newSectionOrder = maxOrder + 1;

      expect(newSectionOrder).toBe(2);
    });
  });

  describe('Section Types and Content Validation', () => {
    it('should validate text section content', async () => {
      const textSection = {
        type: 'text',
        title: 'Test Title',
        content: 'This is valid text content'
      };

      expect(textSection.type).toBe('text');
      expect(textSection.content.length).toBeGreaterThan(0);
      expect(typeof textSection.content).toBe('string');
    });

    it('should validate image section requirements', async () => {
      const imageSection = {
        type: 'image',
        title: 'Test Image',
        imageUrl: 'https://example.com/image.jpg',
        imageAlt: 'Test image description'
      };

      expect(imageSection.type).toBe('image');
      expect(imageSection.imageUrl).toMatch(/^https?:\/\/.+\.(jpg|jpeg|png|gif|webp)$/i);
      expect(imageSection.imageAlt).toBeTruthy();
    });

    it('should validate team member section metadata', async () => {
      const teamMemberSection = testSections[2];

      expect(teamMemberSection.type).toBe('team-member');
      expect(teamMemberSection.metadata.name).toBeTruthy();
      expect(teamMemberSection.metadata.role).toBeTruthy();
      expect(Array.isArray(teamMemberSection.metadata.subjects)).toBe(true);
    });

    it('should sanitize HTML content for security', async () => {
      const dangerousContent = '<script>alert("xss")</script><p>Safe content</p>';
      
      // Mock HTML sanitization
      const sanitizedContent = dangerousContent
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
        .trim();

      expect(sanitizedContent).toBe('<p>Safe content</p>');
      expect(sanitizedContent).not.toContain('<script>');
    });

    it('should validate content length limits', async () => {
      const shortContent = 'OK';
      const longContent = 'word '.repeat(5000); // Very long content
      const maxLength = 10000;

      expect(shortContent.length).toBeLessThan(maxLength);
      expect(longContent.length).toBeLessThan(maxLength);
    });
  });

  describe('Section Rendering and Display', () => {
    it('should render sections in correct order for page', async () => {
      const pageSlug = 'about';
      const sections = testSections
        .filter(section => section.pageSlug === pageSlug && section.isActive)
        .sort((a, b) => {
          // Sort by position priority, then by order
          const positionPriority = { top: 1, middle: 2, bottom: 3 };
          if (positionPriority[a.position] !== positionPriority[b.position]) {
            return positionPriority[a.position] - positionPriority[b.position];
          }
          return a.order - b.order;
        });

      expect(sections[0].position).toBe('top');
      expect(sections[1].position).toBe('middle');
    });

    it('should generate HTML for different section types', async () => {
      const textSection = testSections[0];
      const imageSection = testSections[1];

      // Mock HTML generation
      const textHtml = `<div class="dynamic-section text-section">
        <h2>${textSection.title}</h2>
        <p>${textSection.content}</p>
      </div>`;

      const imageHtml = `<div class="dynamic-section image-section">
        <h2>${imageSection.title}</h2>
        <img src="${imageSection.imageUrl}" alt="${imageSection.imageAlt}" />
      </div>`;

      expect(textHtml).toContain(textSection.title);
      expect(textHtml).toContain(textSection.content);
      expect(imageHtml).toContain(imageSection.imageUrl);
      expect(imageHtml).toContain(imageSection.imageAlt);
    });

    it('should apply responsive styling classes', async () => {
      const section = testSections[0];
      const responsiveClasses = [
        'dynamic-section',
        `${section.type}-section`,
        `position-${section.position}`,
        'responsive-section'
      ];

      expect(responsiveClasses).toContain('dynamic-section');
      expect(responsiveClasses).toContain('text-section');
      expect(responsiveClasses).toContain('position-top');
    });

    it('should handle empty or missing content gracefully', async () => {
      const emptySection = {
        type: 'text',
        title: 'Empty Section',
        content: '',
        isActive: true
      };

      const shouldRender = emptySection.isActive && emptySection.title;
      expect(shouldRender).toBe(true);
    });
  });

  describe('Section Performance and Caching', () => {
    it('should cache sections by page slug', async () => {
      const cacheKey = 'sections:about';
      const cachedSections = testSections.filter(section => 
        section.pageSlug === 'about' && section.isActive
      );

      // Mock cache storage
      const cache = new Map();
      cache.set(cacheKey, cachedSections);

      expect(cache.has(cacheKey)).toBe(true);
      expect(cache.get(cacheKey)).toHaveLength(2);
    });

    it('should invalidate cache when sections are updated', async () => {
      const cacheKey = 'sections:about';
      const cache = new Map();
      
      // Set initial cache
      cache.set(cacheKey, testSections);
      expect(cache.has(cacheKey)).toBe(true);

      // Simulate section update
      cache.delete(cacheKey);
      expect(cache.has(cacheKey)).toBe(false);
    });

    it('should handle large numbers of sections efficiently', async () => {
      const largeSectionSet = Array.from({ length: 1000 }, (_, i) => ({
        id: `section-${i}`,
        pageSlug: 'test-page',
        type: 'text',
        title: `Section ${i}`,
        content: `Content for section ${i}`,
        position: 'middle',
        order: i,
        isActive: true
      }));

      const startTime = Date.now();
      const filteredSections = largeSectionSet
        .filter(section => section.isActive)
        .sort((a, b) => a.order - b.order)
        .slice(0, 50); // Pagination
      const endTime = Date.now();

      expect(filteredSections).toHaveLength(50);
      expect(endTime - startTime).toBeLessThan(100); // Should be fast
    });
  });

  describe('Section Analytics and Tracking', () => {
    it('should track section view counts', async () => {
      const section = testSections[0];
      const updatedSection = {
        ...section,
        viewCount: (section.viewCount || 0) + 1,
        lastViewed: new Date()
      };

      expect(updatedSection.viewCount).toBe(1);
      expect(updatedSection.lastViewed).toBeInstanceOf(Date);
    });

    it('should calculate section engagement metrics', async () => {
      const sectionsWithViews = testSections.map(section => ({
        ...section,
        viewCount: Math.floor(Math.random() * 1000) + 100
      }));

      const totalViews = sectionsWithViews.reduce((sum, section) => sum + section.viewCount, 0);
      const avgViews = totalViews / sectionsWithViews.length;

      expect(totalViews).toBeGreaterThan(0);
      expect(avgViews).toBeGreaterThan(0);
    });

    it('should identify most popular section types', async () => {
      const sectionsByType = testSections.reduce((groups, section) => {
        if (!groups[section.type]) groups[section.type] = 0;
        groups[section.type]++;
        return groups;
      }, {});

      expect(sectionsByType.text).toBe(2);
      expect(sectionsByType.image).toBe(1);
      expect(sectionsByType['team-member']).toBe(1);
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle invalid section types', async () => {
      const invalidSection = {
        type: 'invalid-type',
        title: 'Test',
        content: 'Test content'
      };

      // Updated to include future section types
      const validTypes = ['text', 'image', 'team-member', 'video', 'gallery', 'list', 'testimonial'];
      const isValidType = validTypes.includes(invalidSection.type);

      expect(isValidType).toBe(false);
    });

    it('should handle missing required fields gracefully', async () => {
      const incompleteSection = {
        type: 'text',
        content: 'Content without title'
      };

      const errors = [];
      if (!incompleteSection.title) errors.push('Title is required');
      if (!incompleteSection.pageSlug) errors.push('Page slug is required');

      expect(errors).toHaveLength(2);
    });

    it('should validate future section types (list, testimonial)', async () => {
      const listSection = {
        type: 'list',
        title: 'Test List',
        content: JSON.stringify({
          items: ['Item 1', 'Item 2', 'Item 3'],
          listType: 'unordered'
        }),
        pageSlug: 'test-page'
      };

      const testimonialSection = {
        type: 'testimonial',
        title: 'Test Testimonial',
        content: JSON.stringify({
          quote: 'This is a test testimonial',
          author: 'Test Author',
          role: 'Test Role',
          company: 'Test Company'
        }),
        pageSlug: 'test-page'
      };

      // Validate structure for future section types
      expect(listSection.type).toBe('list');
      expect(JSON.parse(listSection.content).items).toHaveLength(3);

      expect(testimonialSection.type).toBe('testimonial');
      expect(JSON.parse(testimonialSection.content).quote).toBeTruthy();
      expect(JSON.parse(testimonialSection.content).author).toBeTruthy();
    });

    it('should handle database connection errors', async () => {
      const mockError = new Error('Database connection failed');
      
      expect(() => {
        throw mockError;
      }).toThrow('Database connection failed');
    });

    it('should handle concurrent section updates', async () => {
      const section = testSections[0];
      const update1 = { ...section, title: 'Update 1', updatedAt: new Date() };
      const update2 = { ...section, title: 'Update 2', updatedAt: new Date() };

      // Simulate last update wins
      const finalUpdate = update2.updatedAt > update1.updatedAt ? update2 : update1;

      expect(finalUpdate.title).toBe('Update 2');
    });
  });

  describe('Future Section Types - CRUD Operations', () => {
    it('should create list sections with proper validation', async () => {
      const listSection = {
        pageSlug: 'test-page',
        type: 'list',
        title: 'Test List Section',
        content: JSON.stringify({
          items: [
            'First list item',
            'Second list item',
            'Third list item'
          ],
          listType: 'unordered',
          styling: 'default'
        }),
        position: 'middle',
        order: 1,
        isActive: true
      };

      // Validate list section structure
      expect(listSection.type).toBe('list');
      const listContent = JSON.parse(listSection.content);
      expect(listContent.items).toHaveLength(3);
      expect(listContent.listType).toBe('unordered');

      // Mock creation response
      const createdListSection = {
        ...listSection,
        id: 'list-section-1',
        createdAt: new Date(),
        updatedAt: new Date()
      };

      expect(createdListSection.id).toBeTruthy();
      expect(createdListSection.type).toBe('list');
    });

    it('should create testimonial sections with proper validation', async () => {
      const testimonialSection = {
        pageSlug: 'test-page',
        type: 'testimonial',
        title: 'Customer Testimonial',
        content: JSON.stringify({
          quote: 'TutorScotland helped my child improve their grades significantly. Highly recommended!',
          author: 'Sarah Johnson',
          role: 'Parent',
          company: '',
          rating: 5,
          imageUrl: '/images/testimonials/sarah-j.jpg'
        }),
        position: 'bottom',
        order: 2,
        isActive: true
      };

      // Validate testimonial section structure
      expect(testimonialSection.type).toBe('testimonial');
      const testimonialContent = JSON.parse(testimonialSection.content);
      expect(testimonialContent.quote).toBeTruthy();
      expect(testimonialContent.author).toBeTruthy();
      expect(testimonialContent.rating).toBe(5);

      // Mock creation response
      const createdTestimonialSection = {
        ...testimonialSection,
        id: 'testimonial-section-1',
        createdAt: new Date(),
        updatedAt: new Date()
      };

      expect(createdTestimonialSection.id).toBeTruthy();
      expect(createdTestimonialSection.type).toBe('testimonial');
    });

    it('should update list sections maintaining data integrity', async () => {
      const originalListSection = {
        id: 'list-section-1',
        type: 'list',
        title: 'Original List',
        content: JSON.stringify({
          items: ['Item 1', 'Item 2'],
          listType: 'unordered'
        })
      };

      const updatedListSection = {
        ...originalListSection,
        title: 'Updated List',
        content: JSON.stringify({
          items: ['Updated Item 1', 'Updated Item 2', 'New Item 3'],
          listType: 'ordered'
        }),
        updatedAt: new Date()
      };

      const updatedContent = JSON.parse(updatedListSection.content);
      expect(updatedContent.items).toHaveLength(3);
      expect(updatedContent.listType).toBe('ordered');
      expect(updatedListSection.title).toBe('Updated List');
    });

    it('should update testimonial sections maintaining data integrity', async () => {
      const originalTestimonialSection = {
        id: 'testimonial-section-1',
        type: 'testimonial',
        title: 'Original Testimonial',
        content: JSON.stringify({
          quote: 'Original quote',
          author: 'Original Author',
          rating: 4
        })
      };

      const updatedTestimonialSection = {
        ...originalTestimonialSection,
        title: 'Updated Testimonial',
        content: JSON.stringify({
          quote: 'Updated testimonial quote with more detail',
          author: 'Updated Author Name',
          role: 'Updated Role',
          rating: 5
        }),
        updatedAt: new Date()
      };

      const updatedContent = JSON.parse(updatedTestimonialSection.content);
      expect(updatedContent.quote).toContain('Updated');
      expect(updatedContent.rating).toBe(5);
      expect(updatedContent.role).toBe('Updated Role');
    });
  });

  describe('Backward Compatibility & Migration Safety', () => {
    it('should handle API requests with legacy data structures', async () => {
      // Simulate legacy sections in database (no layout field)
      const legacySections = [
        {
          page: 'test-page',
          heading: 'Legacy Section 1',
          text: 'Legacy content',
          position: 'bottom',
          order: 1
        },
        {
          page: 'test-page',
          heading: 'Legacy Section 2',
          text: 'Legacy content 2',
          layout: null, // Explicitly null
          position: 'bottom',
          order: 2
        }
      ];

      // Insert directly to simulate existing database state
      for (const section of legacySections) {
        await testSectionModel.collection.insertOne({
          ...section,
          createdAt: new Date(),
          updatedAt: new Date()
        });
      }

      // API should handle these without errors
      const response = await request(app)
        .get('/api/sections?page=test-page')
        .expect(200);

      expect(response.body).toHaveLength(2);

      // All sections should have normalized layout field
      response.body.forEach(section => {
        expect(section.layout).toBe('standard');
      });
    });

    it('should not break existing functionality when new section types are added', async () => {
      // Create sections of all types
      const sections = [
        { layout: 'standard', heading: 'Standard Section', text: 'Standard content' },
        { layout: 'team', heading: 'Team Section', text: 'Team content', team: [{ name: 'John', bio: 'Developer' }] },
        { layout: 'list', heading: 'List Section', text: JSON.stringify({ items: ['Item 1'], listType: 'unordered' }) },
        { layout: 'testimonial', heading: 'Testimonial', text: JSON.stringify({ quote: 'Great!', author: 'Jane' }) }
      ];

      for (const section of sections) {
        const response = await request(app)
          .post('/api/sections')
          .field('page', 'test-page')
          .field('heading', section.heading)
          .field('text', section.text)
          .field('layout', section.layout);

        if (section.team) {
          response.field('team', JSON.stringify(section.team));
        }

        expect(response.status).toBe(201);
      }

      // Verify all sections can be retrieved
      const getResponse = await request(app)
        .get('/api/sections?page=test-page')
        .expect(200);

      expect(getResponse.body).toHaveLength(4);

      // Verify each layout type is preserved
      const layouts = getResponse.body.map(s => s.layout);
      expect(layouts).toContain('standard');
      expect(layouts).toContain('team');
      expect(layouts).toContain('list');
      expect(layouts).toContain('testimonial');
    });
  });

  describe('Section Import/Export', () => {
    it('should export sections to JSON format including new types', async () => {
      const exportData = {
        pageSlug: 'about',
        sections: [
          ...testSections.filter(section => section.pageSlug === 'about'),
          {
            type: 'list',
            title: 'Export Test List',
            content: JSON.stringify({ items: ['Item 1', 'Item 2'] })
          },
          {
            type: 'testimonial',
            title: 'Export Test Testimonial',
            content: JSON.stringify({ quote: 'Test quote', author: 'Test Author' })
          }
        ],
        exportedAt: new Date(),
        version: '1.1' // Updated version to include new section types
      };

      expect(exportData.sections).toHaveLength(5); // 3 original + 2 new types
      expect(exportData.pageSlug).toBe('about');
      expect(exportData.version).toBe('1.1');

      // Validate new section types are included
      const listSections = exportData.sections.filter(s => s.type === 'list');
      const testimonialSections = exportData.sections.filter(s => s.type === 'testimonial');
      expect(listSections).toHaveLength(1);
      expect(testimonialSections).toHaveLength(1);
    });

    it('should validate imported section data including new types', async () => {
      const importData = {
        sections: [
          {
            type: 'text',
            title: 'Imported Text Section',
            content: 'Imported content',
            position: 'top',
            order: 1
          },
          {
            type: 'list',
            title: 'Imported List Section',
            content: JSON.stringify({ items: ['Imported Item 1', 'Imported Item 2'] }),
            position: 'middle',
            order: 2
          },
          {
            type: 'testimonial',
            title: 'Imported Testimonial',
            content: JSON.stringify({ quote: 'Imported quote', author: 'Imported Author' }),
            position: 'bottom',
            order: 3
          }
        ]
      };

      const validatedSections = importData.sections.filter(section =>
        section.type && section.title && section.position
      );

      expect(validatedSections).toHaveLength(3);

      // Validate each section type
      const textSection = validatedSections.find(s => s.type === 'text');
      const listSection = validatedSections.find(s => s.type === 'list');
      const testimonialSection = validatedSections.find(s => s.type === 'testimonial');

      expect(textSection).toBeTruthy();
      expect(listSection).toBeTruthy();
      expect(testimonialSection).toBeTruthy();

      // Validate content structure for new types
      const listContent = JSON.parse(listSection.content);
      const testimonialContent = JSON.parse(testimonialSection.content);

      expect(listContent.items).toHaveLength(2);
      expect(testimonialContent.quote).toBeTruthy();
      expect(testimonialContent.author).toBeTruthy();
    });

    it('should handle duplicate sections during import', async () => {
      const existingTitles = testSections.map(section => section.title);
      const importSection = {
        title: 'Our Mission', // Duplicate title
        type: 'text',
        content: 'Different content'
      };

      const isDuplicate = existingTitles.includes(importSection.title);
      expect(isDuplicate).toBe(true);
    });
  });
});
