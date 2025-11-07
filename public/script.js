// Initialize the form


document.addEventListener('DOMContentLoaded', function() {
    populateYears();
    setupPhotoPreview();
    setupInstruments(); // ADD THIS LINE
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
// Setup form submission - UPDATED VERSION with instruments handling
function setupFormSubmission() {
    const form = document.getElementById('registrationForm');
    
    form.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const submitButton = form.querySelector('button[type="submit"]');
        const originalText = submitButton.innerHTML;
        
        try {
            // Show loading state
            submitButton.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i>Submitting...';
            submitButton.disabled = true;
            
            // Create FormData object
            let formData = new FormData(form);
            
            // Handle "Other" instrument
            const otherCheckbox = document.getElementById('otherInstrument');
            const otherText = document.getElementById('otherInstrumentText').value;
            
            if (otherCheckbox.checked && otherText.trim() !== '') {
                // Remove the generic "Other" and add the specific instrument
                const instruments = Array.from(form.querySelectorAll('input[name="instruments"]:checked'))
                    .map(cb => cb.value)
                    .filter(value => value !== 'Other');
                
                instruments.push(otherText);
                
                // Create new FormData with updated instruments
                const newFormData = new FormData();
                for (let [key, value] of formData) {
                    if (key !== 'instruments') {
                        newFormData.append(key, value);
                    }
                }
                
                instruments.forEach(instrument => {
                    newFormData.append('instruments', instrument);
                });
                
                formData = newFormData;
            }
            
            console.log('📤 Sending form data to server...');
            
            // Send data to server
            const response = await fetch('/api/members', {
                method: 'POST',
                body: formData
            });
            
            const result = await response.json();
            
            if (result.success) {
                console.log('✅ Form submitted successfully:', result);
                
                // Show success modal
                const successModal = new bootstrap.Modal(document.getElementById('successModal'));
                successModal.show();
                
                // Reset form after successful submission
                setTimeout(() => {
                    form.reset();
                    document.getElementById('photoPreview').innerHTML = '<i class="fas fa-user fa-3x text-muted"></i>';
                    document.getElementById('otherInstrumentField').style.display = 'none';
                    console.log('🔄 Form reset completed');
                }, 2000);
                
            } else {
                throw new Error(result.message || 'Unknown error occurred');
            }
            
        } catch (error) {
            console.error('❌ Form submission error:', error);
            alert('Error submitting form: ' + error.message);
        } finally {
            // Restore button state
            submitButton.innerHTML = originalText;
            submitButton.disabled = false;
        }
    });
}


    // Setup instruments section
    function setupInstruments() {
        const otherCheckbox = document.getElementById('otherInstrument');
        const otherField = document.getElementById('otherInstrumentField');
        
        otherCheckbox.addEventListener('change', function() {
            if (this.checked) {
                otherField.style.display = 'block';
            } else {
                otherField.style.display = 'none';
                document.getElementById('otherInstrumentText').value = '';
            }
        });
        
        // Handle other instrument text in form submission
        const form = document.getElementById('registrationForm');
        form.addEventListener('submit', function() {
            const otherCheckbox = document.getElementById('otherInstrument');
            const otherText = document.getElementById('otherInstrumentText').value;
            
            if (otherCheckbox.checked && otherText.trim() !== '') {
                // Remove the generic "Other" and add the specific instrument
                const instruments = Array.from(form.querySelectorAll('input[name="instruments"]:checked'))
                    .map(cb => cb.value)
                    .filter(value => value !== 'Other');
                
                instruments.push(otherText);
                
                // Clear existing instruments and add updated ones
                const newFormData = new FormData();
                for (let [key, value] of new FormData(form)) {
                    if (key !== 'instruments') {
                        newFormData.append(key, value);
                    }
                }
                
                instruments.forEach(instrument => {
                    newFormData.append('instruments', instrument);
                });
                
                return newFormData;
            }
        });
    }