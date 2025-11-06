let currentPage = 1;
const limit = 10;

document.addEventListener('DOMContentLoaded', function() {
    loadMembers();
    setupSearch();
});

// Load members with pagination
async function loadMembers(page = 1) {
    try {
        currentPage = page;
        const response = await fetch(`/api/members?page=${page}&limit=${limit}`);
        const data = await response.json();
        
        displayMembers(data.members);
        displayPagination(data.pagination);
        updateStats(data.members);
    } catch (error) {
        console.error('Error loading members:', error);
    }
}

// Display members in the dashboard
function displayMembers(members) {
    const container = document.getElementById('membersContainer');
    
    if (members.length === 0) {
        container.innerHTML = `
            <div class="text-center py-5">
                <i class="fas fa-users fa-3x text-muted mb-3"></i>
                <h3>No members found</h3>
                <p class="text-muted">No choir members have registered yet.</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = members.map(member => `
        <div class="card member-card">
            <div class="card-body">
                <div class="row align-items-center">
                    <div class="col-md-2 text-center">
                        ${member.photo ? 
                            `<img src="/uploads/${member.photo}" class="member-photo" alt="${member.fullName}">` :
                            `<div class="member-photo bg-light d-flex align-items-center justify-content-center">
                                <i class="fas fa-user text-muted"></i>
                            </div>`
                        }
                    </div>
                    <div class="col-md-6">
                        <h5 class="card-title">${member.fullName}</h5>
                        <p class="card-text mb-1">
                            <i class="fas fa-phone text-muted me-2"></i>${member.phoneNo}
                        </p>
                        <p class="card-text mb-1">
                            <i class="fas fa-church text-muted me-2"></i>${member.parish}
                        </p>
                        <p class="card-text mb-1">
                            <i class="fas fa-map-marker-alt text-muted me-2"></i>${member.zone} - ${member.area}
                        </p>
                        <p class="card-text">
                            <i class="fas fa-music text-muted me-2"></i>${member.part} • Joined: ${member.joinYear}
                        </p>
                    </div>
                    <div class="col-md-4 text-end">
                        <button class="btn btn-outline-primary btn-sm" onclick="viewMemberDetails('${member._id}')">
                            <i class="fas fa-eye me-1"></i>View Details
                        </button>
                        <button class="btn btn-outline-secondary btn-sm" onclick="printMember('${member._id}')">
                            <i class="fas fa-print me-1"></i>Print
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `).join('');
}

// Display pagination
function displayPagination(pagination) {
    const paginationContainer = document.getElementById('pagination');
    
    let paginationHTML = `
        <ul class="pagination justify-content-center">
    `;
    
    // Previous button
    if (pagination.hasPrev) {
        paginationHTML += `
            <li class="page-item">
                <a class="page-link" href="#" onclick="loadMembers(${pagination.currentPage - 1})">Previous</a>
            </li>
        `;
    }
    
    // Page numbers
    for (let i = 1; i <= pagination.totalPages; i++) {
        paginationHTML += `
            <li class="page-item ${i === pagination.currentPage ? 'active' : ''}">
                <a class="page-link" href="#" onclick="loadMembers(${i})">${i}</a>
            </li>
        `;
    }
    
    // Next button
    if (pagination.hasNext) {
        paginationHTML += `
            <li class="page-item">
                <a class="page-link" href="#" onclick="loadMembers(${pagination.currentPage + 1})">Next</a>
            </li>
        `;
    }
    
    paginationHTML += `</ul>`;
    paginationContainer.innerHTML = paginationHTML;
}

// Update statistics
function updateStats(members) {
    document.getElementById('totalMembers').textContent = members.length;
    
    const currentYear = new Date().getFullYear();
    const currentYearMembers = members.filter(m => m.joinYear === currentYear).length;
    document.getElementById('activeMembers').textContent = currentYearMembers;
    
    const uniqueParishes = new Set(members.map(m => m.parish)).size;
    document.getElementById('totalParishes').textContent = uniqueParishes;
    
    const uniqueZones = new Set(members.map(m => m.zone)).size;
    document.getElementById('totalZones').textContent = uniqueZones;
}

// Search functionality
function setupSearch() {
    const searchInput = document.getElementById('searchInput');
    let searchTimeout;
    
    searchInput.addEventListener('input', function() {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(searchMembers, 500);
    });
}

async function searchMembers() {
    const searchTerm = document.getElementById('searchInput').value.trim();
    
    if (searchTerm === '') {
        loadMembers();
        return;
    }
    
    try {
        const response = await fetch(`/api/members/search?term=${encodeURIComponent(searchTerm)}`);
        const members = await response.json();
        displayMembers(members);
        
        // Hide pagination during search
        document.getElementById('pagination').innerHTML = '';
    } catch (error) {
        console.error('Error searching members:', error);
    }
}

// View member details
async function viewMemberDetails(memberId) {
    try {
        const response = await fetch('/api/members');
        const data = await response.json();
        const member = data.members.find(m => m._id === memberId);
        
        if (member) {
            const modalBody = document.getElementById('memberDetails');
            modalBody.innerHTML = `
                <div class="row">
                    <div class="col-md-4 text-center">
                        ${member.photo ? 
                            `<img src="/uploads/${member.photo}" class="img-fluid rounded" alt="${member.fullName}">` :
                            `<div class="bg-light rounded p-5 text-center">
                                <i class="fas fa-user fa-3x text-muted"></i>
                            </div>`
                        }
                    </div>
                    <div class="col-md-8">
                        <h4>${member.fullName}</h4>
                        <hr>
                        <div class="row">
                            <div class="col-6">
                                <p><strong>Gender:</strong> ${member.gender}</p>
                                <p><strong>Status:</strong> ${member.status}</p>
                                <p><strong>State of Origin:</strong> ${member.stateOfOrigin}</p>
                                <p><strong>Home Town:</strong> ${member.homeTown}</p>
                            </div>
                            <div class="col-6">
                                <p><strong>Occupation:</strong> ${member.occupation}</p>
                                <p><strong>Phone:</strong> ${member.phoneNo}</p>
                                <p><strong>Voice Part:</strong> ${member.part}</p>
                                <p><strong>Joined:</strong> ${member.joinYear}</p>
                            </div>
                        </div>
                        <p><strong>Church:</strong> ${member.parish}</p>
                        <p><strong>Parish Address:</strong> ${member.parishAddress}</p>
                        <p><strong>Residential Address:</strong> ${member.residentialAddress}</p>
                        <p><strong>Position(s):</strong> ${member.position && member.position.length > 0 ? member.position.join(', ') : 'None'}</p>
                        <p><strong>Zone/Area:</strong> ${member.zone} / ${member.area}</p>
                    </div>
                </div>
            `;
            
            const modal = new bootstrap.Modal(document.getElementById('memberModal'));
            modal.show();
        }
    } catch (error) {
        console.error('Error loading member details:', error);
    }
}

// Print individual member
function printMember(memberId) {
    // This would open a print-friendly version of the member details
    // For now, we'll just trigger the print dialog for the current page
    window.print();
}