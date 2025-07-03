// static/script.js

document.addEventListener('DOMContentLoaded', () => {
    // Get references to DOM elements
    const targetCourseInput = document.getElementById('targetCourse');
    const prerequisitesInput = document.getElementById('prerequisites');
    const checkButton = document.getElementById('checkButton');
    const exportButton = document.getElementById('exportButton');
    const resultsOutput = document.getElementById('resultsOutput');
    const loadingIndicator = document.getElementById('loadingIndicator');
    const messageArea = document.getElementById('messageArea');

    let lastEligibleStudents = []; // To store data for export

    // Function to show a message (success or error)
    function showMessage(message, type = 'info') {
        messageArea.textContent = message;
        messageArea.classList.remove('hidden', 'text-red-600', 'text-green-600', 'text-gray-600');
        if (type === 'error') {
            messageArea.classList.add('text-red-600');
        } else if (type === 'success') {
            messageArea.classList.add('text-green-600');
        } else {
            messageArea.classList.add('text-gray-600');
        }
        messageArea.classList.remove('hidden'); // Ensure it's visible
    }

    // Function to hide messages
    function hideMessage() {
        messageArea.classList.add('hidden');
        messageArea.textContent = '';
    }

    // Function to handle the eligibility check
    checkButton.addEventListener('click', async () => {
        hideMessage();
        resultsOutput.innerHTML = 'No results yet.'; // Clear previous results
        exportButton.disabled = true; // Disable export until new valid results
        loadingIndicator.classList.remove('hidden'); // Show loading spinner
        checkButton.disabled = true; // Disable check button during processing

        const targetCourse = targetCourseInput.value;
        const prerequisites = prerequisitesInput.value;

        try {
            const response = await fetch('/check_eligibility', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    target_course: targetCourse,
                    prerequisites: prerequisites
                })
            });

            const data = await response.json();

            if (data.success) {
                lastEligibleStudents = data.eligible_students; // Store for export
                displayResults(data.eligible_students);
                showMessage(data.message, 'success');
                if (data.eligible_students.length > 0) {
                    exportButton.disabled = false; // Enable export if there are students
                }
            } else {
                displayResults([]); // Clear results on error
                // Check for specific error message about file not found
                if (data.message.includes("data.xlsx' not found")) {
                    showMessage("Error: 'data.xlsx' not found. Please ensure the Excel file is uploaded to your Replit project's root directory.", 'error');
                } else {
                    showMessage(data.message, 'error');
                }
                exportButton.disabled = true;
            }

        } catch (error) {
            console.error('Error:', error);
            // Generic error message if network or parsing fails
            showMessage('An unexpected error occurred during the eligibility check. Please check your network and try again.', 'error');
            exportButton.disabled = true;
        } finally {
            loadingIndicator.classList.add('hidden'); // Hide loading spinner
            checkButton.disabled = false; // Re-enable check button
        }
    });

    // Function to display results in the output area
    function displayResults(students) {
        resultsOutput.innerHTML = ''; // Clear existing content
        if (students && students.length > 0) {
            const ul = document.createElement('ul');
            ul.classList.add('list-disc', 'list-inside', 'space-y-1');
            students.forEach(student => {
                const li = document.createElement('li');
                li.textContent = `${student.number}. ${student.id} - ${student.full_name}`;
                ul.appendChild(li);
            });
            resultsOutput.appendChild(ul);
        } else {
            resultsOutput.textContent = 'No eligible students found for the given criteria, or no criteria entered.';
        }
    }

    // Function to handle export to CSV
    exportButton.addEventListener('click', async () => {
        if (lastEligibleStudents.length === 0) {
            showMessage('No data to export. Please run an eligibility check first.', 'info');
            return;
        }

        try {
            // Fetch CSV data from the Flask backend
            const response = await fetch('/export_current_list');
            const csvText = await response.text();

            if (response.ok) {
                // Create a Blob from the CSV text
                const blob = new Blob([csvText], { type: 'text/csv;charset=utf-8;' });
                const url = URL.createObjectURL(blob);

                // Create a temporary link element
                const link = document.createElement('a');
                link.setAttribute('href', url);
                link.setAttribute('download', 'eligible_students.csv'); // Suggested filename

                // Append to body, click, and remove
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);

                // Revoke the object URL to free up memory
                URL.revokeObjectURL(url);
                showMessage('CSV exported successfully!', 'success');
            } else {
                const errorData = await response.json(); // Assuming error response is JSON
                showMessage(`Export failed: ${errorData.message}`, 'error');
            }
        } catch (error) {
            console.error('Export error:', error);
            showMessage('An error occurred during CSV export. Please try again.', 'error');
        }
    });
});
