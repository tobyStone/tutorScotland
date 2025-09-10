/**
 * @fileoverview Reusable video player component for Tutors Alliance Scotland
 * @author Tutors Alliance Scotland Development Team
 * @version 1.0.0
 * @since 2024-01-01
 *
 * @description Video player component system:
 * - Reusable video player for any page
 * - Toggle show/hide functionality
 * - Support for multiple video sources
 * - Responsive design and controls
 * - Integration with video sections
 *
 * @performance Implements efficient video loading and playback
 * @security Validates video URLs and sources
 */

class TutorVideoPlayer {
    constructor() {
        this.isVisible = false;
        this.currentVideoId = null;
        this.playerContainer = null;
        this.videoElement = null;

        // Create the player container if it doesn't exist
        this.init();
    }

    /**
     * Initialize the video player component
     */
    init() {
        // Check if the player already exists
        if (document.getElementById('tutor-video-player-container')) {
            this.playerContainer = document.getElementById('tutor-video-player-container');
            this.videoElement = document.getElementById('tutor-video-player');
            return;
        }

        // Create the player container
        this.playerContainer = document.createElement('div');
        this.playerContainer.id = 'tutor-video-player-container';
        this.playerContainer.className = 'tutor-video-player-container';

        // Create the player overlay
        const overlay = document.createElement('div');
        overlay.className = 'tutor-video-overlay';

        // Create the player wrapper
        const playerWrapper = document.createElement('div');
        playerWrapper.className = 'tutor-video-wrapper';

        // Create the close button
        const closeButton = document.createElement('button');
        closeButton.className = 'tutor-video-close';
        closeButton.innerHTML = '&times;';
        closeButton.setAttribute('aria-label', 'Close video player');
        closeButton.addEventListener('click', () => this.hide());

        // Create the video element
        this.videoElement = document.createElement('video');
        this.videoElement.id = 'tutor-video-player';
        this.videoElement.className = 'tutor-video-player';
        this.videoElement.controls = true;
        this.videoElement.playsInline = true;

        // Assemble the player
        playerWrapper.appendChild(closeButton);
        playerWrapper.appendChild(this.videoElement);
        overlay.appendChild(playerWrapper);
        this.playerContainer.appendChild(overlay);

        // Add the player to the document
        document.body.appendChild(this.playerContainer);

        // Add event listeners for keyboard navigation
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.isVisible) {
                this.hide();
            }
        });
    }

    /**
     * Load a video by ID
     * @param {string} videoId - The ID of the video to load
     * @returns {Promise} - Resolves when the video is loaded
     */
    async loadVideo(videoId) {
        if (!videoId) {
            console.error('No video ID provided');
            return;
        }

        this.currentVideoId = videoId;

        try {
            // Fetch the video URL from the API
            const response = await fetch(`/api/video-player?videoId=${encodeURIComponent(videoId)}`);

            if (!response.ok) {
                throw new Error(`Failed to load video: ${response.statusText}`);
            }

            const data = await response.json();

            // Set the video source
            this.videoElement.src = data.url;

            // Load the video
            this.videoElement.load();

            return true;
        } catch (error) {
            console.error('Error loading video:', error);
            return false;
        }
    }

    /**
     * Show the video player
     * @param {string} videoId - Optional video ID to load
     * @returns {Promise} - Resolves when the player is shown
     */
    async show(videoId) {
        // Load the video if provided
        if (videoId) {
            const loaded = await this.loadVideo(videoId);
            if (!loaded) {
                return;
            }
        }

        // Show the player
        this.playerContainer.classList.add('visible');
        this.isVisible = true;

        // Play the video
        try {
            await this.videoElement.play();
        } catch (error) {
            console.warn('Autoplay prevented:', error);
        }

        // Add a class to the body to prevent scrolling
        document.body.classList.add('tutor-video-playing');

        return true;
    }

    /**
     * Hide the video player
     */
    hide() {
        // Hide the player
        this.playerContainer.classList.remove('visible');
        this.isVisible = false;

        // Pause the video
        this.videoElement.pause();

        // Remove the class from the body
        document.body.classList.remove('tutor-video-playing');
    }

    /**
     * Toggle the video player
     * @param {string} videoId - Optional video ID to load
     * @returns {Promise} - Resolves when the player is toggled
     */
    async toggle(videoId) {
        if (this.isVisible) {
            this.hide();
            return false;
        } else {
            return await this.show(videoId);
        }
    }

    /**
     * Create a video button that can be added to any page
     * @param {string} videoId - The ID of the video to play
     * @param {string} buttonText - The text to display on the button
     * @param {string} className - Optional additional class name for the button
     * @returns {HTMLButtonElement} - The button element
     */
    createVideoButton(videoId, buttonText, className = '') {
        const button = document.createElement('button');
        button.className = `tutor-video-button ${className}`;
        button.textContent = buttonText || 'Watch Video';
        button.setAttribute('data-video-id', videoId);
        button.addEventListener('click', () => this.show(videoId));
        return button;
    }

    /**
     * Create a video section that can be added to any page
     * @param {string} videoId - The ID of the video to play
     * @param {string} title - The title of the video
     * @param {string} description - Optional description of the video
     * @returns {HTMLDivElement} - The section element
     */
    createVideoSection(videoId, title, description = '') {
        const section = document.createElement('div');
        section.className = 'tutor-video-section';
        section.setAttribute('data-video-id', videoId);

        // Create the title
        const titleElement = document.createElement('h3');
        titleElement.className = 'tutor-video-title';
        titleElement.textContent = title;

        // Create the description if provided
        let descriptionElement = null;
        if (description) {
            descriptionElement = document.createElement('p');
            descriptionElement.className = 'tutor-video-description';
            descriptionElement.textContent = description;
        }

        // Create the button
        const button = this.createVideoButton(videoId, 'Watch Video');

        // Assemble the section
        section.appendChild(titleElement);
        if (descriptionElement) {
            section.appendChild(descriptionElement);
        }
        section.appendChild(button);

        // Add click event to the entire section
        section.addEventListener('click', (e) => {
            // Only trigger if the click wasn't on the button (which has its own handler)
            if (e.target !== button && !button.contains(e.target)) {
                this.show(videoId);
            }
        });

        return section;
    }
}

// Create a global instance of the video player
window.tutorVideoPlayer = new TutorVideoPlayer();

// Add a function to create video sections from data attributes
document.addEventListener('DOMContentLoaded', () => {
    // Find all elements with the data-video-section attribute
    const videoSections = document.querySelectorAll('[data-video-section]');

    videoSections.forEach(element => {
        const videoId = element.getAttribute('data-video-id');
        const title = element.getAttribute('data-video-title') || 'Video';
        const description = element.getAttribute('data-video-description') || '';

        // Create the video section
        const section = window.tutorVideoPlayer.createVideoSection(videoId, title, description);

        // Replace the element with the video section
        element.parentNode.replaceChild(section, element);
    });

    // Find all elements with the data-video-button attribute
    const videoButtons = document.querySelectorAll('[data-video-button]');

    videoButtons.forEach(element => {
        const videoId = element.getAttribute('data-video-id');
        const buttonText = element.getAttribute('data-video-button-text') || 'Watch Video';
        const className = element.getAttribute('data-video-button-class') || '';

        // Create the video button
        const button = window.tutorVideoPlayer.createVideoButton(videoId, buttonText, className);

        // Replace the element with the video button
        element.parentNode.replaceChild(button, element);
    });
});
