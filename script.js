document.addEventListener('DOMContentLoaded', () => {

    // --- State Management ---
    const state = {
        guests: [], // { id, name, tableId }
        tables: [], // { id, name, shape, capacity, x, y }
        tableCounter: 1,
        guestCounter: 1,
        draggedGuestId: null,
        draggedTableId: null,
        offsetX: 0,
        offsetY: 0
    };

    // --- DOM Elements ---
    const elements = {
        guestNameInput: document.getElementById('guest-name-input'),
        addGuestBtn: document.getElementById('add-guest-btn'),
        unassignedList: document.getElementById('unassigned-guests'),
        unassignedCount: document.getElementById('unassigned-count'),
        
        tableShape: document.getElementById('table-shape'),
        tableCapacity: document.getElementById('table-capacity'),
        tableName: document.getElementById('table-name'),
        addTableBtn: document.getElementById('add-table-btn'),
        
        roomMap: document.getElementById('room-map'),
        roomMapContainer: document.querySelector('.room-map-container'),
        
        exportBtn: document.getElementById('export-btn'),
        downloadPngBtn: document.getElementById('download-png-btn'),
        resetBtn: document.getElementById('reset-btn')
    };

    // --- Initialization ---

    function init() {
        setupEventListeners();
        loadState(); // Llama a autoguardado al arrancar
    }

    function setupEventListeners() {
        // Add Guest
        elements.addGuestBtn.addEventListener('click', handleAddGuest);
        elements.guestNameInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') handleAddGuest();
        });

        // Add Table
        elements.addTableBtn.addEventListener('click', handleAddTable);

        // Sidebar drop zone (for bringing guests back to Unassigned)
        elements.unassignedList.addEventListener('dragover', handleDragOverZone);
        elements.unassignedList.addEventListener('drop', handleDropOnZone);

        // Map container drop zone (for tables dragging, though we use custom logic for tables)
        
        // Export & Reset
        elements.exportBtn.addEventListener('click', handleExport);
        elements.downloadPngBtn.addEventListener('click', handleDownloadPng);
        elements.resetBtn.addEventListener('click', handleReset);
    }

    // --- State Persistence (LocalStorage) ---

    function saveState() {
        localStorage.setItem('weddingAppState', JSON.stringify(state));
    }

    function loadState() {
        const saved = localStorage.getItem('weddingAppState');
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                state.guests = parsed.guests || [];
                state.tables = parsed.tables || [];
                state.tableCounter = parsed.tableCounter || 1;
                state.guestCounter = parsed.guestCounter || 1;
                
                // Regenerate tables on map
                state.tables.forEach(tableData => {
                    renderTableDOM(tableData);
                });
            } catch (e) {
                console.error("Error cargando el guardado local:", e);
            }
        }
        updateAllUI();
    }

    // --- Guests Logic ---

    function handleAddGuest() {
        const name = elements.guestNameInput.value.trim();
        if (!name) return;

        const newGuest = {
            id: `guest-${state.guestCounter++}`,
            name: name,
            tableId: 'unassigned'
        };

        state.guests.push(newGuest);
        elements.guestNameInput.value = '';
        elements.guestNameInput.focus();
        
        updateAllUI();
        saveState();
    }

    function removeGuest(guestId) {
        state.guests = state.guests.filter(g => g.id !== guestId);
        updateAllUI();
        saveState();
    }

    function moveGuestToTable(guestId, tableId) {
        const guest = state.guests.find(g => g.id === guestId);
        if (!guest) return;

        if (tableId !== 'unassigned') {
            const table = state.tables.find(t => t.id === tableId);
            const currentGuestsCount = state.guests.filter(g => g.tableId === tableId).length;
            
            if (currentGuestsCount >= table.capacity) {
                alert(`La ${table.name} ya está llena.`);
                return;
            }
        }

        guest.tableId = tableId;
        updateAllUI();
        saveState();
    }

    // --- Tables Logic ---

    function handleAddTable() {
        const shape = elements.tableShape.value;
        const capacity = parseInt(elements.tableCapacity.value) || 8;
        let name = elements.tableName.value.trim();
        
        if (!name) {
            name = `Mesa ${state.tableCounter}`;
        }

        // Center position somewhat based on scroll
        const containerRect = elements.roomMapContainer.getBoundingClientRect();
        
        const newTable = {
            id: `table-${state.tableCounter++}`,
            name: name,
            shape: shape,
            capacity: capacity,
            x: elements.roomMapContainer.scrollLeft + (containerRect.width / 2) - 100 + (Math.random() * 50 - 25),
            y: elements.roomMapContainer.scrollTop + (containerRect.height / 2) - 100 + (Math.random() * 50 - 25)
        };

        state.tables.push(newTable);
        elements.tableName.value = ''; // Reset optional name
        
        renderTableDOM(newTable);
        updateAllUI();
        saveState();
    }

    function removeTable(tableId) {
        // Move all guests in this table back to unassigned
        state.guests.forEach(g => {
            if (g.tableId === tableId) {
                g.tableId = 'unassigned';
            }
        });

        // Remove table
        state.tables = state.tables.filter(t => t.id !== tableId);
        
        // Remove from DOM
        const tableElement = document.getElementById(tableId);
        if (tableElement) {
            tableElement.remove();
        }

        updateAllUI();
        saveState();
    }

    // --- Rendering UI ---

    function updateAllUI() {
        renderUnassignedGuests();
        // Update guests in tables
        state.tables.forEach(table => {
            renderGuestsInTable(table.id);
        });
    }

    function renderUnassignedGuests() {
        const unassignedList = state.guests.filter(g => g.tableId === 'unassigned');
        elements.unassignedCount.textContent = unassignedList.length;
        
        elements.unassignedList.innerHTML = '';
        
        if (unassignedList.length === 0) {
            elements.unassignedList.innerHTML = '<div class="empty-state">No hay invitados en espera.</div>';
            return;
        }

        unassignedList.forEach(guest => {
            const el = createGuestElement(guest);
            elements.unassignedList.appendChild(el);
        });
    }

    function renderGuestsInTable(tableId) {
        const tableElement = document.getElementById(tableId);
        if (!tableElement) return;

        const guestsListEl = tableElement.querySelector('.table-guests-list');
        const capacityEl = tableElement.querySelector('.table-capacity');
        
        const tableData = state.tables.find(t => t.id === tableId);
        const guestsInTable = state.guests.filter(g => g.tableId === tableId);
        
        // Update capacity text
        capacityEl.textContent = `${guestsInTable.length} / ${tableData.capacity} personas`;
        if (guestsInTable.length >= tableData.capacity) {
            tableElement.classList.add('table-full');
        } else {
            tableElement.classList.remove('table-full');
        }

        guestsListEl.innerHTML = '';
        guestsInTable.forEach(guest => {
            const el = createGuestElement(guest);
            guestsListEl.appendChild(el);
        });
    }

    function createGuestElement(guest) {
        const div = document.createElement('div');
        div.className = 'guest-item';
        div.draggable = true;
        div.id = guest.id;

        div.innerHTML = `
            <span class="guest-name"><i class="fas fa-user" style="margin-right: 8px; color: var(--primary-color);"></i> ${guest.name}</span>
            <span class="remove-guest" title="Eliminar invitado"><i class="fas fa-times"></i></span>
        `;

        // Click on the guest item to send back to unassigned list
        div.addEventListener('click', (e) => {
            if (e.target.closest('.remove-guest')) return;
            if (guest.tableId !== 'unassigned') {
                moveGuestToTable(guest.id, 'unassigned');
            }
        });

        // Remove guest completely (X button, now only visible in side bar via CSS)
        div.querySelector('.remove-guest').addEventListener('click', (e) => {
            e.stopPropagation();
            removeGuest(guest.id);
        });

        // Dragging events for guests (Mouse)
        div.addEventListener('dragstart', (e) => {
            state.draggedGuestId = guest.id;
            e.dataTransfer.setData('text/plain', guest.id);
            setTimeout(() => { div.style.opacity = '0.4'; }, 0);
        });

        div.addEventListener('dragend', (e) => {
            div.style.opacity = '1';
            state.draggedGuestId = null;
            document.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over'));
        });

        // Touch Events for Mobile Dragging of Guests
        let guestIsDragging = false;
        
        div.addEventListener('touchstart', (e) => {
            // Prevent scrolling when touching a guest
            if (!e.target.closest('.remove-guest')) {
                state.draggedGuestId = guest.id;
                guestIsDragging = true;
                div.style.opacity = '0.4';
                // Optional: visual clue like border
                div.style.border = '2px dashed var(--primary-color)';
            }
        }, {passive: false});

        div.addEventListener('touchmove', (e) => {
            if (!guestIsDragging) return;
            e.preventDefault(); // Stop page scrolling
            
            const touch = e.touches[0];
            
            // Highlight element under finger
            const elUnderFinger = document.elementFromPoint(touch.clientX, touch.clientY);
            document.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over'));
            
            if (elUnderFinger) {
                let dropZone = elUnderFinger.closest('.wedding-table') || elUnderFinger.closest('#unassigned-guests');
                if (dropZone) {
                    dropZone.classList.add('drag-over');
                }
            }
        }, {passive: false});

        div.addEventListener('touchend', (e) => {
            if (!guestIsDragging) return;
            guestIsDragging = false;
            div.style.opacity = '1';
            div.style.border = '';
            
            const touch = e.changedTouches[0];
            const elUnderFinger = document.elementFromPoint(touch.clientX, touch.clientY);
            
            document.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over'));
            
            if (elUnderFinger && state.draggedGuestId) {
                let tableZone = elUnderFinger.closest('.wedding-table');
                let unassignedZone = elUnderFinger.closest('#unassigned-guests');
                
                if (tableZone) {
                    moveGuestToTable(guest.id, tableZone.dataset.tableId);
                } else if (unassignedZone) {
                    moveGuestToTable(guest.id, 'unassigned');
                }
            }
            state.draggedGuestId = null;
        });

        return div;
    }

    function renderTableDOM(tableData) {
        const table = document.createElement('div');
        table.className = `wedding-table ${tableData.shape}`;
        table.id = tableData.id;
        table.dataset.tableId = tableData.id;
        
        // Apply dimensions and positions
        table.style.left = `${tableData.x}px`;
        table.style.top = `${tableData.y}px`;

        if (tableData.shape === 'round') {
            // Adjust size based on capacity (approximate logic to make it look nice)
            const baseSize = 160;
            const size = baseSize + (tableData.capacity * 8);
            table.style.width = `${size}px`;
            table.style.height = `${size}px`;
        } else if (tableData.shape === 'rectangular') {
            const baseWidth = 220;
            const baseHeight = 120;
            table.style.width = `${baseWidth + (tableData.capacity * 6)}px`;
            table.style.minHeight = `${baseHeight}px`;
        } else if (tableData.shape === 'presidential') {
            const baseWidth = 400;
            const baseHeight = 100;
            table.style.width = `${baseWidth + (tableData.capacity * 10)}px`;
            table.style.minHeight = `${baseHeight}px`;
        } else if (tableData.shape === 'dj') {
            const baseWidth = 120;
            const baseHeight = 100;
            table.style.width = `${baseWidth}px`;
            table.style.minHeight = `${baseHeight}px`;
        }

        table.innerHTML = `
            <div class="delete-table-btn" title="Eliminar mesa"><i class="fas fa-trash-alt"></i></div>
            <div class="table-header">
                <div class="table-name">${tableData.name}</div>
                <div class="table-capacity">0 / ${tableData.capacity} personas</div>
            </div>
            <div class="table-guests-list" data-table-id="${tableData.id}">
                <!-- Guests dropped here -->
            </div>
        `;

        elements.roomMap.appendChild(table);

        // Init dragging logic for the table itself
        setupTableDragging(table, tableData);

        // Setup drop zone for the table
        const guestsListEl = table.querySelector('.table-guests-list');
        // We make the whole table a dropzone
        table.addEventListener('dragover', handleDragOverZone);
        table.addEventListener('drop', handleDropOnZone);
        table.addEventListener('dragleave', handleDragLeaveZone);

        // Delete table event
        table.querySelector('.delete-table-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            if(confirm(`¿Estás seguro de eliminar la ${tableData.name}? Los invitados volverán a la lista de espera.`)) {
                removeTable(tableData.id);
            }
        });
    }

    // --- Drag and Drop Logic (Guests between drop zones) ---

    function handleDragOverZone(e) {
        e.preventDefault(); // Necessary to allow dropping
        // Only accept if a guest is being dragged
        if (!state.draggedGuestId) return;

        let dropZone = e.target.closest('.wedding-table');
        if (!dropZone) {
            dropZone = e.target.closest('#unassigned-guests');
        }

        if (dropZone) {
            dropZone.classList.add('drag-over');
        }
    }

    function handleDragLeaveZone(e) {
        let dropZone = e.target.closest('.wedding-table') || e.target.closest('#unassigned-guests');
        if (dropZone) {
            dropZone.classList.remove('drag-over');
        }
    }

    function handleDropOnZone(e) {
        e.preventDefault();
        const guestId = e.dataTransfer.getData('text/plain');
        
        let targetTableId = 'unassigned';
        
        const tableZone = e.target.closest('.wedding-table');
        const unassignedZone = e.target.closest('#unassigned-guests');

        if (tableZone) {
            targetTableId = tableZone.dataset.tableId;
            tableZone.classList.remove('drag-over');
        } else if (unassignedZone) {
            targetTableId = 'unassigned';
            unassignedZone.classList.remove('drag-over');
        } else {
            return; // Dropped somewhere invalid
        }

        moveGuestToTable(guestId, targetTableId);
    }

    // --- Table Free Dragging Logic ---

    function setupTableDragging(tableElement, tableData) {
        let isDragging = false;
        let startX, startY, initialLeft, initialTop;

        tableElement.addEventListener('mousedown', (e) => {
            // Prevent dragging if clicking on a guest or delete button
            if (e.target.closest('.guest-item') || e.target.closest('.delete-table-btn')) return;

            isDragging = true;
            startX = e.clientX;
            startY = e.clientY;
            initialLeft = parseInt(tableElement.style.left) || 0;
            initialTop = parseInt(tableElement.style.top) || 0;

            // Optional: Bring to front
            tableElement.style.zIndex = 100;
        });

        document.addEventListener('mousemove', (e) => {
            if (!isDragging) return;

            const dx = e.clientX - startX;
            const dy = e.clientY - startY;

            let newLeft = initialLeft + dx;
            let newTop = initialTop + dy;

            // Boundaries
            if (newLeft < 0) newLeft = 0;
            if (newTop < 0) newTop = 0;

            tableElement.style.left = `${newLeft}px`;
            tableElement.style.top = `${newTop}px`;
        });

        document.addEventListener('mouseup', () => {
            if (isDragging) {
                isDragging = false;
                tableElement.style.zIndex = 1;
                
                // Save new position in state
                tableData.x = parseInt(tableElement.style.left);
                tableData.y = parseInt(tableElement.style.top);
                saveState();
            }
        });

        // --- Touch Events for Mobile Table Dragging --- //
        tableElement.addEventListener('touchstart', (e) => {
            if (e.target.closest('.guest-item') || e.target.closest('.delete-table-btn')) return;

            isDragging = true;
            const touch = e.touches[0];
            startX = touch.clientX;
            startY = touch.clientY;
            initialLeft = parseInt(tableElement.style.left) || 0;
            initialTop = parseInt(tableElement.style.top) || 0;

            tableElement.style.zIndex = 100;
        }, {passive: false});

        document.addEventListener('touchmove', (e) => {
            if (!isDragging) return;
            e.preventDefault(); // Stop standard scrolling

            const touch = e.touches[0];
            const dx = touch.clientX - startX;
            const dy = touch.clientY - startY;

            let newLeft = initialLeft + dx;
            let newTop = initialTop + dy;

            if (newLeft < 0) newLeft = 0;
            if (newTop < 0) newTop = 0;

            tableElement.style.left = `${newLeft}px`;
            tableElement.style.top = `${newTop}px`;
        }, {passive: false});

        document.addEventListener('touchend', (e) => {
            if (isDragging) {
                isDragging = false;
                tableElement.style.zIndex = 1;
                
                tableData.x = parseInt(tableElement.style.left);
                tableData.y = parseInt(tableElement.style.top);
                saveState();
            }
        });
    }

    // --- Export Logic ---
    function handleDownloadPng() {
        const originalButtonText = elements.downloadPngBtn.innerHTML;
        elements.downloadPngBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Generando...';
        elements.downloadPngBtn.disabled = true;

        if (typeof html2canvas !== 'undefined') {
            
            // Calculate bounding box of all tables
            const tablesEls = elements.roomMap.querySelectorAll('.wedding-table');
            if (tablesEls.length === 0) {
                alert("No hay mesas en el plano para exportar.");
                elements.downloadPngBtn.innerHTML = originalButtonText;
                elements.downloadPngBtn.disabled = false;
                return;
            }

            let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

            tablesEls.forEach(el => {
                const rect = el.getBoundingClientRect();
                const mapRect = elements.roomMap.getBoundingClientRect();
                
                // Coordinates relative to the map container itself
                const relativeLeft = rect.left - mapRect.left;
                const relativeTop = rect.top - mapRect.top;
                const relativeRight = relativeLeft + rect.width;
                const relativeBottom = relativeTop + rect.height;

                if (relativeLeft < minX) minX = relativeLeft;
                if (relativeTop < minY) minY = relativeTop;
                if (relativeRight > maxX) maxX = relativeRight;
                if (relativeBottom > maxY) maxY = relativeBottom;
            });

            // Add some padding around the edges
            const padding = 50;
            minX = Math.max(0, minX - padding);
            minY = Math.max(0, minY - padding);
            maxX = maxX + padding;
            maxY = maxY + padding;

            const cropWidth = maxX - minX;
            const cropHeight = maxY - minY;

            html2canvas(elements.roomMap, {
                backgroundColor: '#f0f0f0', 
                scale: 4, 
                useCORS: true, 
                logging: false,
                x: minX,
                y: minY,
                width: cropWidth,
                height: cropHeight
            }).then(canvas => {
                const link = document.createElement('a');
                link.download = 'distribucion_mesas.png';
                link.href = canvas.toDataURL('image/png');
                link.click();
                
                elements.downloadPngBtn.innerHTML = originalButtonText;
                elements.downloadPngBtn.disabled = false;
            }).catch(err => {
                console.error('Error generando PNG:', err);
                alert('Hubo un error al generar la imagen. Intenta de nuevo.');
                elements.downloadPngBtn.innerHTML = originalButtonText;
                elements.downloadPngBtn.disabled = false;
            });
        } else {
            alert('La librería para exportar imágenes no se ha cargado.');
            elements.downloadPngBtn.innerHTML = originalButtonText;
            elements.downloadPngBtn.disabled = false;
        }
    }

    function handleExport() {
        const payload = {
            tables: state.tables,
            guests: state.guests
        };
        
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(payload, null, 2));
        const downloadAnchorNode = document.createElement('a');
        downloadAnchorNode.setAttribute("href",     dataStr);
        downloadAnchorNode.setAttribute("download", "distribucion_mesas_boda.json");
        document.body.appendChild(downloadAnchorNode); // required for firefox
        downloadAnchorNode.click();
        downloadAnchorNode.remove();
    }

    function handleReset() {
        if (confirm('¿Estás seguro de que quieres borrar TODAS las mesas e invitados y empezar de cero? Esto no se puede deshacer.')) {
            localStorage.removeItem('weddingAppState');
            location.reload();
        }
    }

    // Launch!
    init();

});
