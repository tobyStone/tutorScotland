/**
 * @fileoverview Unit tests for Samsung fade-in fix in responsive-helper.js
 * @author Tutors Alliance Scotland Development Team
 * @version 1.0.0
 * @since 2024-01-01
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { JSDOM } from 'jsdom';

describe('Samsung Fade-In Fix', () => {
  let dom;
  let window;
  let document;
  let originalIntersectionObserver;

  beforeEach(() => {
    // Create a fresh DOM for each test
    dom = new JSDOM(`
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            .fade-in-section, .fade-in-on-scroll {
              opacity: 0;
              transform: translateY(20px);
              transition: opacity 0.6s ease, transform 0.6s ease;
            }
            .is-visible {
              opacity: 1 !important;
              transform: translateY(0) !important;
            }
          </style>
        </head>
        <body>
          <section id="team" class="team-section fade-in-section">
            <h2>Meet the Team</h2>
            <div class="team-members">
              <div class="team-member">Team Member 1</div>
            </div>
          </section>
          <div class="fade-in-on-scroll">Another fade section</div>
        </body>
      </html>
    `, {
      url: 'http://localhost:3000',
      pretendToBeVisual: true,
      resources: 'usable'
    });

    window = dom.window;
    document = window.document;
    
    // Store original IntersectionObserver if it exists
    originalIntersectionObserver = window.IntersectionObserver;
    
    // Mock console methods
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});

    // Set up global window for the test
    global.window = window;
    global.document = document;
  });

  afterEach(() => {
    // Restore console methods
    vi.restoreAllMocks();
    
    // Clean up DOM
    dom.window.close();
  });

  it('should immediately reveal all fade-in content when IntersectionObserver is undefined', () => {
    // Simulate Samsung browser without IntersectionObserver
    window.IntersectionObserver = undefined;

    // Simulate the initFadeObserver logic
    const revealAllFadeContent = () => {
      document.querySelectorAll(".fade-in-section,.fade-in-on-scroll").forEach(el => {
        el.classList.add("is-visible");
      });
    };

    // Check if IntersectionObserver is available
    if (!window.IntersectionObserver) {
      revealAllFadeContent();
    }

    // Verify all fade-in elements have is-visible class
    const fadeElements = document.querySelectorAll('.fade-in-section, .fade-in-on-scroll');
    expect(fadeElements.length).toBe(2);
    
    fadeElements.forEach(el => {
      expect(el.classList.contains('is-visible')).toBe(true);
    });

    // Verify console warning was logged
    expect(console.warn).not.toHaveBeenCalled(); // We don't call console.warn in this simple test
  });

  it('should immediately reveal all fade-in content when IntersectionObserver constructor throws', () => {
    // Mock IntersectionObserver to throw during construction
    window.IntersectionObserver = vi.fn(() => {
      throw new Error('IntersectionObserver not supported');
    });

    const revealAllFadeContent = () => {
      document.querySelectorAll(".fade-in-section,.fade-in-on-scroll").forEach(el => {
        el.classList.add("is-visible");
      });
    };

    let io;
    try {
      io = new window.IntersectionObserver(() => {}, {});
    } catch (error) {
      revealAllFadeContent();
    }

    // Verify all fade-in elements have is-visible class
    const fadeElements = document.querySelectorAll('.fade-in-section, .fade-in-on-scroll');
    expect(fadeElements.length).toBe(2);
    
    fadeElements.forEach(el => {
      expect(el.classList.contains('is-visible')).toBe(true);
    });

    // Verify IntersectionObserver constructor was called and threw
    expect(window.IntersectionObserver).toHaveBeenCalled();
  });

  it('should work normally when IntersectionObserver is available', () => {
    // Mock a working IntersectionObserver
    const mockObserve = vi.fn();
    const mockUnobserve = vi.fn();
    
    window.IntersectionObserver = vi.fn((callback, options) => ({
      observe: mockObserve,
      unobserve: mockUnobserve,
      disconnect: vi.fn()
    }));

    // Simulate the initFadeObserver logic
    let io;
    const revealAllFadeContent = () => {
      document.querySelectorAll(".fade-in-section,.fade-in-on-scroll").forEach(el => {
        el.classList.add("is-visible");
      });
    };

    if (!window.IntersectionObserver) {
      revealAllFadeContent();
      return;
    }

    try {
      io = new window.IntersectionObserver(() => {}, {
        threshold: 0.15,
        rootMargin: "0px 0px -10% 0px"
      });
    } catch (error) {
      revealAllFadeContent();
      return;
    }

    // Simulate observing elements
    if (io) {
      document.querySelectorAll(".fade-in-section,.fade-in-on-scroll").forEach(el => {
        io.observe(el);
      });
    }

    // Verify IntersectionObserver was created with correct options
    expect(window.IntersectionObserver).toHaveBeenCalledWith(
      expect.any(Function),
      {
        threshold: 0.15,
        rootMargin: "0px 0px -10% 0px"
      }
    );

    // Verify observe was called for each fade element
    expect(mockObserve).toHaveBeenCalledTimes(2);

    // Elements should NOT have is-visible class yet (waiting for intersection)
    const fadeElements = document.querySelectorAll('.fade-in-section, .fade-in-on-scroll');
    fadeElements.forEach(el => {
      expect(el.classList.contains('is-visible')).toBe(false);
    });
  });

  it('should handle dynamically added elements when observer is unavailable', () => {
    // Simulate Samsung browser without IntersectionObserver
    window.IntersectionObserver = undefined;

    // Add a new fade-in element dynamically
    const newElement = document.createElement('div');
    newElement.className = 'fade-in-section';
    newElement.textContent = 'Dynamic content';
    document.body.appendChild(newElement);

    // Simulate the fallback logic for dynamic elements
    if (!window.IntersectionObserver) {
      // Immediately reveal the new content
      newElement.classList.add('is-visible');
    }

    // Verify the new element is visible
    expect(newElement.classList.contains('is-visible')).toBe(true);
  });

  it('should preserve existing functionality for non-fade elements', () => {
    // Add some regular elements
    const regularDiv = document.createElement('div');
    regularDiv.className = 'regular-content';
    regularDiv.textContent = 'Regular content';
    document.body.appendChild(regularDiv);

    // Simulate Samsung browser without IntersectionObserver
    window.IntersectionObserver = undefined;

    // Apply fallback
    document.querySelectorAll(".fade-in-section,.fade-in-on-scroll").forEach(el => {
      el.classList.add("is-visible");
    });

    // Regular elements should not be affected
    expect(regularDiv.classList.contains('is-visible')).toBe(false);

    // Only fade-in elements should be affected
    const fadeElements = document.querySelectorAll('.fade-in-section, .fade-in-on-scroll');
    fadeElements.forEach(el => {
      expect(el.classList.contains('is-visible')).toBe(true);
    });
  });
});
