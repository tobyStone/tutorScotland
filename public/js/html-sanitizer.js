/**
 * @fileoverview HTML sanitization utility for TutorScotland frontend
 * @author Tutors Alliance Scotland Development Team
 * @version 1.0.0
 * @since 2024-12-09
 *
 * @description Client-side HTML sanitization to prevent XSS attacks:
 * - Sanitizes HTML content before DOM insertion
 * - Allows safe HTML tags and attributes
 * - Removes dangerous scripts and event handlers
 * - Validates and sanitizes URLs
 *
 * @security Implements defense-in-depth XSS prevention
 * @performance Lightweight sanitization with minimal overhead
 */

/**
 * List of allowed HTML tags for content sanitization
 */
const ALLOWED_TAGS = [
    'p', 'br', 'strong', 'b', 'em', 'i', 'u', 'span', 'div',
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    'ul', 'ol', 'li',
    'a', 'img',
    'blockquote', 'pre', 'code'
];

/**
 * List of allowed attributes for specific tags
 */
const ALLOWED_ATTRIBUTES = {
    'a': ['href', 'title', 'target'],
    'img': ['src', 'alt', 'title', 'width', 'height'],
    'span': ['class'],
    'div': ['class'],
    'p': ['class'],
    'h1': ['class'], 'h2': ['class'], 'h3': ['class'], 
    'h4': ['class'], 'h5': ['class'], 'h6': ['class']
};

/**
 * List of allowed URL protocols
 */
const ALLOWED_PROTOCOLS = ['http:', 'https:', 'mailto:'];

/**
 * Sanitize HTML content to prevent XSS attacks
 * @param {string} html - HTML content to sanitize
 * @param {Object} options - Sanitization options
 * @returns {string} Sanitized HTML content
 */
function sanitizeHTML(html, options = {}) {
    if (typeof html !== 'string') {
        return '';
    }

    const {
        allowedTags = ALLOWED_TAGS,
        allowedAttributes = ALLOWED_ATTRIBUTES,
        allowedProtocols = ALLOWED_PROTOCOLS
    } = options;

    // Create a temporary DOM element to parse HTML
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = html;

    // Recursively sanitize all elements
    sanitizeElement(tempDiv, allowedTags, allowedAttributes, allowedProtocols);

    return tempDiv.innerHTML;
}

/**
 * Recursively sanitize a DOM element and its children
 * @param {Element} element - Element to sanitize
 * @param {Array} allowedTags - Allowed HTML tags
 * @param {Object} allowedAttributes - Allowed attributes per tag
 * @param {Array} allowedProtocols - Allowed URL protocols
 */
function sanitizeElement(element, allowedTags, allowedAttributes, allowedProtocols) {
    const children = Array.from(element.children);
    
    for (const child of children) {
        const tagName = child.tagName.toLowerCase();
        
        // Remove disallowed tags
        if (!allowedTags.includes(tagName)) {
            // Keep text content but remove the tag
            const textContent = child.textContent;
            const textNode = document.createTextNode(textContent);
            child.parentNode.replaceChild(textNode, child);
            continue;
        }
        
        // Sanitize attributes
        const allowedAttrs = allowedAttributes[tagName] || [];
        const attributes = Array.from(child.attributes);
        
        for (const attr of attributes) {
            const attrName = attr.name.toLowerCase();
            
            // Remove disallowed attributes
            if (!allowedAttrs.includes(attrName)) {
                child.removeAttribute(attr.name);
                continue;
            }
            
            // Sanitize URL attributes
            if (['href', 'src'].includes(attrName)) {
                const url = attr.value;
                if (!isValidURL(url, allowedProtocols)) {
                    child.removeAttribute(attr.name);
                }
            }
            
            // Remove javascript: and data: URLs
            if (attr.value.toLowerCase().includes('javascript:') || 
                attr.value.toLowerCase().includes('data:')) {
                child.removeAttribute(attr.name);
            }
        }
        
        // Remove event handler attributes (onclick, onload, etc.)
        const eventAttributes = Array.from(child.attributes).filter(attr => 
            attr.name.toLowerCase().startsWith('on')
        );
        for (const eventAttr of eventAttributes) {
            child.removeAttribute(eventAttr.name);
        }
        
        // Recursively sanitize children
        sanitizeElement(child, allowedTags, allowedAttributes, allowedProtocols);
    }
}

/**
 * Validate URL and check if protocol is allowed
 * @param {string} url - URL to validate
 * @param {Array} allowedProtocols - Allowed URL protocols
 * @returns {boolean} True if URL is valid and safe
 */
function isValidURL(url, allowedProtocols) {
    if (typeof url !== 'string' || url.length === 0) {
        return false;
    }
    
    // Allow relative URLs
    if (url.startsWith('/') || url.startsWith('./') || url.startsWith('../')) {
        return true;
    }
    
    try {
        const urlObj = new URL(url);
        return allowedProtocols.includes(urlObj.protocol);
    } catch (error) {
        return false;
    }
}

/**
 * Safely set innerHTML with sanitization
 * @param {Element} element - Target element
 * @param {string} html - HTML content to set
 * @param {Object} options - Sanitization options
 */
function safeSetInnerHTML(element, html, options = {}) {
    if (!element || typeof html !== 'string') {
        return;
    }
    
    const sanitizedHTML = sanitizeHTML(html, options);
    element.innerHTML = sanitizedHTML;
}

/**
 * Safely set text content (no HTML parsing)
 * @param {Element} element - Target element
 * @param {string} text - Text content to set
 */
function safeSetTextContent(element, text) {
    if (!element || typeof text !== 'string') {
        return;
    }
    
    element.textContent = text;
}

/**
 * Safely set element attribute with validation
 * @param {Element} element - Target element
 * @param {string} attribute - Attribute name
 * @param {string} value - Attribute value
 */
function safeSetAttribute(element, attribute, value) {
    if (!element || typeof attribute !== 'string' || typeof value !== 'string') {
        return;
    }
    
    const attrName = attribute.toLowerCase();
    
    // Validate URL attributes
    if (['href', 'src'].includes(attrName)) {
        if (!isValidURL(value, ALLOWED_PROTOCOLS)) {
            console.warn(`Blocked unsafe URL in ${attrName}:`, value);
            return;
        }
    }
    
    // Block event handlers
    if (attrName.startsWith('on')) {
        console.warn(`Blocked event handler attribute:`, attrName);
        return;
    }
    
    element.setAttribute(attribute, value);
}

/**
 * Create a safe button element with validated URL
 * @param {string} label - Button label
 * @param {string} url - Button URL
 * @param {string} className - CSS class name
 * @returns {Element|null} Safe button element or null if invalid
 */
function createSafeButton(label, url, className = 'button aurora') {
    if (!label || !url) {
        return null;
    }
    
    if (!isValidURL(url, ALLOWED_PROTOCOLS)) {
        console.warn('Blocked unsafe button URL:', url);
        return null;
    }
    
    const button = document.createElement('a');
    button.className = className;
    button.textContent = label; // Use textContent to prevent HTML injection
    button.href = url;
    
    return button;
}

// Export functions for use in other scripts
window.HTMLSanitizer = {
    sanitizeHTML,
    safeSetInnerHTML,
    safeSetTextContent,
    safeSetAttribute,
    createSafeButton,
    isValidURL
};
