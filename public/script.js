// Initialize the form
document.addEventListener('DOMContentLoaded', function() {
    populateYears();
    setupPhotoPreview();
    setupFormSubmission();
});

// Populate years for join year dropdown
function populateYears() {
    const joinYearSelect = document.getElementById('joinYear');
    const currentYear = new Date().getFullYear();
    
    for (let year = currentYear; year >= 1990; year--) {
        const option = document.createElement('option');
        option.value = year;
        option.textContent = year;
        joinYearSelect.appendChild(option);
    }
}

// Setup photo preview
function setupPhotoPreview() {
    const photoInput = document.getElementById('photo');
    const photoPreview = document.getElementById('photoPreview');
    
    photoInput.addEventListener('change', function(e) {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = function(e) {
                photoPreview.innerHTML = `<img src="${e.target.result}" alt="Preview">`;
            };
            reader.readAsDataURL(file);
        }
    });
}

// Setup form submission
function setupFormSubmission() {
    const form = document.getElementById('registrationForm');
    
    form.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const submitButton = form.querySelector('button[type="submit"]');
        const originalText = submitButton.innerHTML;
        
        try {
            submitButton.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i>Submitting...';
            submitButton.disabled = true;
            
            const formData = new FormData(form);
            
            const response = await fetch('/api/members', {
                method: 'POST',
                body: formData
            });
            
            const result = await response.json();
            
            if (result.success) {
                // Show success modal
                const successModal = new bootstrap.Modal(document.getElementById('successModal'));
                successModal.show();
                
                // Reset form
                form.reset();
                document.getElementById('photoPreview').innerHTML = '<i class="fas fa-user fa-3x text-muted"></i>';
            } else {
                throw new Error(result.message);
            }
            
        } catch (error) {
            alert('Error: ' + error.message);
        } finally {
            submitButton.innerHTML = originalText;
            submitButton.disabled = false;
        }
    });
}