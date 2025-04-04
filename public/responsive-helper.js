/**
 * Responsive Helper Script
 * Helps manage responsive behavior for the Tutors Alliance Scotland website
 */

document.addEventListener('DOMContentLoaded', function() {
    // Check if we're in portrait mode on a restricted viewport
    function checkPortraitRestricted() {
        const isPortrait = window.matchMedia("(orientation: portrait)").matches;
        const isRestricted = window.matchMedia("(max-width: 900px)").matches;
        
        // If we're in portrait mode on a restricted viewport
        if (isPortrait && isRestricted) {
            // Hide the left column (shield and ribbons)
            const leftCols = document.querySelectorAll('.left-col');
            leftCols.forEach(col => {
                col.style.display = 'none';
            });
            
            // Adjust the right column to take full width
            const rightCols = document.querySelectorAll('.right-col');
            rightCols.forEach(col => {
                col.style.width = '100%';
                col.style.marginLeft = '0';
            });
            
            // Center the mission statement
            const missionStatements = document.querySelectorAll('.mission-statement');
            missionStatements.forEach(statement => {
                statement.style.textAlign = 'center';
                statement.style.margin = '20px auto';
            });
            
            // Adjust mission rows
            const missionRows = document.querySelectorAll('.mission-row');
            missionRows.forEach(row => {
                row.style.flexDirection = 'column';
                row.style.alignItems = 'center';
            });
        } else {
            // Reset styles if we're not in portrait mode on a restricted viewport
            const leftCols = document.querySelectorAll('.left-col');
            leftCols.forEach(col => {
                col.style.display = '';
            });
            
            const rightCols = document.querySelectorAll('.right-col');
            rightCols.forEach(col => {
                col.style.width = '';
                col.style.marginLeft = '';
            });
            
            const missionStatements = document.querySelectorAll('.mission-statement');
            missionStatements.forEach(statement => {
                statement.style.textAlign = '';
                statement.style.margin = '';
            });
            
            const missionRows = document.querySelectorAll('.mission-row');
            missionRows.forEach(row => {
                row.style.flexDirection = '';
                row.style.alignItems = '';
            });
        }
    }
    
    // Run on page load
    checkPortraitRestricted();
    
    // Run on window resize and orientation change
    window.addEventListener('resize', checkPortraitRestricted);
    window.addEventListener('orientationchange', checkPortraitRestricted);
});
