// Main variables
let scene, camera, renderer, controls, tshirt, currentPrint;
let isModelLoading = false;
let tshirtColor = 0xffffff; // Default to white

// Image state
let imageState = {
    position: { x: 0, y: 0 },
    scale: 1.0,
    rotation: 0
};

// UI Elements
const ui = {
  colorPicker: null,
  editBtn: null,
  closeEditBtn: null,
  editControls: null,
  mainControls: null,
  posXSlider: null,
  posYSlider: null,
  scaleSlider: null,
  rotationSlider: null
};

// Initialize the scene
function init() {
    // Create scene
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf8f9fa);

    // Create camera
    camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.z = 2;

    // Create renderer
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    document.getElementById('container').appendChild(renderer.domElement);

    // Add orbit controls
    controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.enablePan = false;
    controls.maxPolarAngle = Math.PI / 1.5;
    controls.minDistance = 1.5;
    controls.maxDistance = 3;

    // Add lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);

    const directionalLight1 = new THREE.DirectionalLight(0xffffff, 0.6);
    directionalLight1.position.set(1, 1, 1);
    scene.add(directionalLight1);

    const directionalLight2 = new THREE.DirectionalLight(0xffffff, 0.3);
    directionalLight2.position.set(-1, -1, -1);
    scene.add(directionalLight2);

    // Add a subtle rim light
    const rimLight = new THREE.DirectionalLight(0xffffff, 0.8);
    rimLight.position.set(0, 1, 2);
    scene.add(rimLight);

    // Load T-shirt model
    loadModel();

    // Initialize UI elements first
    initUI();
    
    // Basic event listeners that don't depend on UI elements
    window.addEventListener('resize', onWindowResize);
    
    // Setup UI-dependent event listeners after a small delay to ensure DOM is ready
    setTimeout(() => {
        // Color picker
        const colorPicker = document.getElementById('colorPicker');
        if (colorPicker) {
            colorPicker.addEventListener('input', updateTshirtColor);
        }
        
        // File input
        const fileInput = document.getElementById('fileInput');
        if (fileInput) {
            fileInput.addEventListener('change', handleImageUpload);
        }
        
        // Screenshot button
        const screenshotBtn = document.getElementById('screenshotBtn');
        if (screenshotBtn) {
            screenshotBtn.addEventListener('click', takeScreenshot);
        }
        
        // Reset button
        const resetBtn = document.getElementById('resetBtn');
        if (resetBtn) {
            resetBtn.addEventListener('click', resetView);
        }
        
        // Edit controls
        if (ui.editBtn) {
            ui.editBtn.addEventListener('click', showEditControls);
        }
        
        if (ui.closeEditBtn) {
            ui.closeEditBtn.addEventListener('click', hideEditControls);
        }
        
        // Slider controls
        if (ui.posXSlider && ui.posYSlider) {
            ui.posXSlider.addEventListener('input', updateImagePosition);
            ui.posYSlider.addEventListener('input', updateImagePosition);
        }
        
        if (ui.scaleSlider) {
            ui.scaleSlider.addEventListener('input', updateImageScale);
        }
        
        if (ui.rotationSlider) {
            ui.rotationSlider.addEventListener('input', updateImageRotation);
        }
        
        console.log('UI elements initialized:', {
            editBtn: !!ui.editBtn,
            closeEditBtn: !!ui.closeEditBtn,
            editControls: !!ui.editControls,
            mainControls: !!ui.mainControls,
            sliders: {
                posX: !!ui.posXSlider,
                posY: !!ui.posYSlider,
                scale: !!ui.scaleSlider,
                rotation: !!ui.rotationSlider
            }
        });
        
        // Handle touch events for mobile
        setupTouchControls();
    }, 100);

    // Start animation loop
    animate();
}

let tshirtUvWireframe = null;

function loadModel() {
    if (typeof THREE === 'undefined' || !THREE.GLTFLoader) {
        console.error('Three.js or GLTFLoader not loaded');
        const loading = document.getElementById('loading');
        if (loading) {
            loading.innerHTML = '<h2>Error: Required libraries not loaded. Please refresh the page.</h2>';
        }
        return;
    }
    
    isModelLoading = true;
    const loader = new THREE.GLTFLoader();
    
    loader.load(
        'Tshirt.glb',
        function (gltf) {
            try {
                tshirt = gltf.scene;
                scene.add(tshirt);
                // Extract UVs for wireframe overlay
                tshirt.traverse(function(child) {
                    if (child.isMesh && child.geometry && child.geometry.attributes.uv && child.geometry.index) {
                        const uvAttr = child.geometry.attributes.uv;
                        const idxAttr = child.geometry.index;
                        tshirtUvWireframe = [];
                        for (let i = 0; i < idxAttr.count; i += 3) {
                            const a = idxAttr.getX(i);
                            const b = idxAttr.getX(i+1);
                            const c = idxAttr.getX(i+2);
                            const uvA = [uvAttr.getX(a), uvAttr.getY(a)];
                            const uvB = [uvAttr.getX(b), uvAttr.getY(b)];
                            const uvC = [uvAttr.getX(c), uvAttr.getY(c)];
                            tshirtUvWireframe.push([uvA, uvB, uvC]);
                        }
                    }
                });
                // Log the model structure
                console.log('Model structure:', tshirt);
                // Calculate bounding box and center the model
                const box = new THREE.Box3().setFromObject(tshirt);
                const size = box.getSize(new THREE.Vector3());
                const center = box.getCenter(new THREE.Vector3());
                // Log model properties
                console.log('Model bounding box:', {
                    min: box.min,
                    max: box.max,
                    size: size,
                    center: center
                });
                
                // If the bounding box is empty, the model might be too small or not properly loaded
                if (size.length() < 0.001) {
                    console.warn('Model bounding box is very small. The model might not be visible.');
                    // Try to manually set a visible size
                    tshirt.scale.set(1, 1, 1);
                    tshirt.position.set(0, 0, 0);
                } else {
                    // Position the model at the center of the scene
                    tshirt.position.set(-center.x, -center.y, -center.z);
                    
                    // Scale the model to a reasonable size
                    const maxDim = Math.max(size.x, size.y, size.z);
                    const scale = maxDim > 0 ? 2 / maxDim : 1; // Prevent division by zero
                    tshirt.scale.set(scale, scale, scale);
                }
                
                // Store original materials and set up material for texturing
                tshirt.traverse(function (child) {
                    if (child.isMesh) {
                        console.log('Mesh found:', child.name || 'unnamed');
                        
                        // Store original material
                        child.userData.originalMaterial = child.material;
                        
                        // Create a new material that can be textured
                        child.material = new THREE.MeshPhongMaterial({
    color: tshirtColor,
    side: THREE.DoubleSide,
    transparent: false,
    shininess: 10
});
                        
                        // Enable shadows
                        child.castShadow = true;
                        child.receiveShadow = true;
                    }
                });
                
                
                
            } catch (error) {
                console.error('Error processing model:', error);
            } finally {
                isModelLoading = false;
                
                // Hide loading screen
                const loading = document.getElementById('loading');
                if (loading) {
                    loading.classList.add('hidden');
                }
            }
        },
        undefined,
        function (error) {
            console.error('Error loading model:', error);
            isModelLoading = false;
            
            const loading = document.getElementById('loading');
            if (loading) {
                loading.innerHTML = '<h2>Error loading 3D model. Please check the console for details.</h2>';
            }
        }
    );
}

function updateTshirtColor(event) {
    if (isModelLoading) return;
    
    tshirtColor = new THREE.Color(event.target.value);
    
    tshirt.traverse(function (child) {
        if (child.isMesh && !child.userData.isPrint) {
            child.material.color.set(tshirtColor);
        }
    });
}

function handleImageUpload(event) {
    if (isModelLoading || !tshirt) {
        console.error('T-shirt model not ready');
        return;
    }
    
    const file = event.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = function(e) {
        const image = new Image();
        image.onload = function() {
            // Create texture from the uploaded image
            const texture = new THREE.Texture(image);
            texture.flipY = false;
            texture.needsUpdate = true;
            
            // Find the T-shirt mesh (first mesh in the model)
            let shirtMesh = null;
            tshirt.traverse(function(child) {
                if (child.isMesh && !shirtMesh) {
                    shirtMesh = child;
                }
            });
            
            if (!shirtMesh) {
                console.error('Could not find T-shirt mesh');
                return;
            }
            
            // Store the original material
            if (!shirtMesh.userData.originalMaterial) {
                shirtMesh.userData.originalMaterial = shirtMesh.material;
            }
            
            // DEBUG: function to apply template.png as a texture for mapping verification
            window.applyTemplateTextureToShirt = function() {
                const debugImg = new window.Image();
                debugImg.onload = function() {
                    const debugTexture = new THREE.Texture(debugImg);
                    debugTexture.flipY = false;
                    debugTexture.needsUpdate = true;
                    const debugMat = new THREE.MeshStandardMaterial({
                        map: debugTexture,
                        color: 0xffffff,
                        side: THREE.DoubleSide,
                        roughness: 0.7,
                        metalness: 0.0
                    });
                    shirtMesh.material = debugMat;
                    console.log('Applied template.png as shirt texture for debug');
                };
                debugImg.src = 'template.png?v=1';
            };
            
            // Use MeshStandardMaterial for robust PBR and texture support
            texture.encoding = THREE.sRGBEncoding;
            texture.flipY = false; // GLTF models often need flipY = false
            // Prevent tiling: use ClampToEdgeWrapping
            texture.wrapS = THREE.ClampToEdgeWrapping;
            texture.wrapT = THREE.ClampToEdgeWrapping;
            // Always rotate/scale from center
            texture.center.set(0.5, 0.5);
            // Apply current imageState
            const scale = Math.max(0.1, Math.min(1.0, imageState.scale));
            texture.repeat.set(scale, scale);
            // Offset so image stays centered
            texture.offset.set(0.5 - scale / 2 + imageState.position.x, 0.5 - scale / 2 + imageState.position.y);
            texture.rotation = (imageState.rotation * Math.PI) / 180;
            texture.needsUpdate = true;

            const material = new THREE.MeshStandardMaterial({
                map: texture,
                color: 0xffffff, // No tint
                side: THREE.DoubleSide,
                roughness: 0.7,
                metalness: 0.0
            });

            shirtMesh.material = material;

            currentPrint = {
                mesh: shirtMesh,
                texture: texture,
                originalMaterial: shirtMesh.userData.originalMaterial
            };

            console.log('Image texture applied to T-shirt', {texture, mesh: shirtMesh});
        };
        image.src = e.target.result;
    };
    reader.readAsDataURL(file);
}

// Remove edit button and edit controls logic from initUI and elsewhere
// (No-op: UI and event code for edit controls is now obsolete and can be ignored)

function initUI() {
    console.log('Initializing UI elements...');
    try {
        // Cache UI elements
        ui.colorPicker = document.getElementById('colorPicker');
        ui.editBtn = document.getElementById('editBtn');
        ui.closeEditBtn = document.getElementById('closeEdit');
        ui.editControls = document.getElementById('editControls');
        ui.mainControls = document.getElementById('mainControls');
        ui.posXSlider = document.getElementById('posX');
        ui.posYSlider = document.getElementById('posY');
        ui.scaleSlider = document.getElementById('scale');
        ui.rotationSlider = document.getElementById('rotation');
        
        // Log any missing elements
        const elements = [
            { name: 'colorPicker', element: ui.colorPicker },
            { name: 'editBtn', element: ui.editBtn },
            { name: 'closeEdit', element: ui.closeEditBtn },
            { name: 'editControls', element: ui.editControls },
            { name: 'mainControls', element: ui.mainControls },
            { name: 'posX', element: ui.posXSlider },
            { name: 'posY', element: ui.posYSlider },
            { name: 'scale', element: ui.scaleSlider },
            { name: 'rotation', element: ui.rotationSlider }
        ];
        
        const missing = elements.filter(item => !item.element).map(item => item.name);
        if (missing.length > 0) {
            console.warn('Missing UI elements:', missing);
        } else {
            console.log('All UI elements found');
        }
        
        // Color picker handler
        if (ui.colorPicker) {
            ui.colorPicker.value = '#ffffff';
            ui.colorPicker.addEventListener('input', function(e) {
                tshirtColor = parseInt(e.target.value.replace('#', '0x'));
                if (tshirt) {
                    tshirt.traverse(function(child) {
                        if (child.isMesh && child.material) {
                            child.material.color.setHex(tshirtColor);
                        }
                    });
                }
            });
        }

        // Image upload handler
        const fileInput = document.getElementById('fileInput');
        if (fileInput) {
            fileInput.addEventListener('change', handleImageUpload);
        }

        // Edit Placement button handler
        const editPlacementBtn = document.getElementById('editPlacementBtn');
        if (editPlacementBtn && ui.editControls && ui.mainControls) {
            editPlacementBtn.addEventListener('click', function() {
                ui.mainControls.classList.add('hidden');
                ui.editControls.classList.remove('hidden');
                updateSliderValues();
            });
        }
        
        // Set initial values if we have a current print
        if (currentPrint) {
            updateSliderValues();
        }

        // Attach slider event listeners and debug logs
        if (ui.posXSlider) {
            ui.posXSlider.addEventListener('input', function(e) {
                console.log('posXSlider changed:', e.target.value);
                updateImagePosition();
            });
        }
        if (ui.posYSlider) {
            ui.posYSlider.addEventListener('input', function(e) {
                console.log('posYSlider changed:', e.target.value);
                updateImagePosition();
            });
        }
        if (ui.scaleSlider) {
            ui.scaleSlider.addEventListener('input', function(e) {
                console.log('scaleSlider changed:', e.target.value);
                updateImageScale();
            });
        }
        if (ui.rotationSlider) {
            ui.rotationSlider.addEventListener('input', function(e) {
                console.log('rotationSlider changed:', e.target.value);
                updateImageRotation();
            });
        }
        // Fix Done button logic
        if (ui.closeEditBtn && ui.editControls && ui.mainControls) {
            ui.closeEditBtn.addEventListener('click', function() {
                ui.editControls.classList.add('hidden');
                ui.mainControls.classList.remove('hidden');
            });
        }

        // UV Editor logic
        const uvEditorBtn = document.getElementById('uvEditorBtn');
        const uvEditorModal = document.getElementById('uvEditorModal');
        const uvEditorCanvas = document.getElementById('uvEditorCanvas');
        const closeUvEditorBtn = document.getElementById('closeUvEditorBtn');
        let templateImg = null;
        // Preload template.png
        function loadTemplateImg(cb) {
            if (templateImg) return cb && cb();
            templateImg = new window.Image();
            templateImg.onload = function() {
                uvEditorCanvas.width = templateImg.width;
                uvEditorCanvas.height = templateImg.height;
                if (cb) cb();
            };
            // Always load from foonmockup folder with cache busting
            templateImg.src = 'template.png?v=' + Date.now();
        }
        // --- Interactive UV Editor ---
        let isDragging = false;
        let dragStart = null;
        let dragStartState = null;
        let lastTouchDist = null;
        let isTouch = false;

        function getEventPos(e) {
            if (e.touches && e.touches.length > 0) {
                // Touch event
                const rect = uvEditorCanvas.getBoundingClientRect();
                return Array.from(e.touches).map(touch => ({
                    x: (touch.clientX - rect.left) / rect.width,
                    y: (touch.clientY - rect.top) / rect.height
                }));
            } else {
                // Mouse event
                const rect = uvEditorCanvas.getBoundingClientRect();
                return [{
                    x: (e.clientX - rect.left) / rect.width,
                    y: (e.clientY - rect.top) / rect.height
                }];
            }
        }

        function drawUvEditor() {
            if (!uvEditorCanvas) return;
            const ctx = uvEditorCanvas.getContext('2d');
            ctx.clearRect(0, 0, uvEditorCanvas.width, uvEditorCanvas.height);
            // Draw template.png pixel-perfect
            if (templateImg && templateImg.complete) {
                ctx.drawImage(templateImg, 0, 0);
            } else {
                ctx.fillStyle = '#ccc';
                ctx.fillRect(0, 0, uvEditorCanvas.width, uvEditorCanvas.height);
            }
            // Draw imported image at UV position/scale/rotation (in template.png pixel space)
            if (currentPrint && currentPrint.texture && currentPrint.texture.image) {
                const img = currentPrint.texture.image;
                const scale = Math.max(0.1, Math.min(1.0, imageState.scale));
                const size = templateImg.width * scale;
                const centerX = templateImg.width * imageState.position.x;
                const centerY = templateImg.height * imageState.position.y;
                ctx.save();
                ctx.translate(centerX, centerY);
                ctx.rotate((imageState.rotation * Math.PI) / 180);
                ctx.drawImage(img, -size / 2, -size / 2, size, size);
                ctx.restore();
            }
            // Draw UV wireframe overlay
            if (tshirtUvWireframe && templateImg) {
                ctx.save();
                ctx.globalAlpha = 0.45;
                ctx.strokeStyle = '#00ff00';
                ctx.lineWidth = 1;
                for (const tri of tshirtUvWireframe) {
                    ctx.beginPath();
                    for (let i = 0; i < 3; ++i) {
                        const uv = tri[i];
                        const px = uv[0] * templateImg.width;
                        const py = uv[1] * templateImg.height;
                        if (i === 0) ctx.moveTo(px, py);
                        else ctx.lineTo(px, py);
                    }
                    ctx.closePath();
                    ctx.stroke();
                }
                ctx.restore();
            }
        }

        // Mouse/touch drag to move
        uvEditorCanvas.addEventListener('mousedown', function(e) {
            isDragging = true;
            isTouch = false;
            dragStart = getEventPos(e)[0];
            dragStartState = { ...imageState };
        });
        uvEditorCanvas.addEventListener('mousemove', function(e) {
            if (!isDragging || isTouch) return;
            const pos = getEventPos(e)[0];
            const dx = pos.x - dragStart.x;
            const dy = pos.y - dragStart.y;
            imageState.position.x = clampPosition(dragStartState.position.x + dx, imageState.scale);
            imageState.position.y = clampPosition(dragStartState.position.y + dy, imageState.scale);
            updateTextureTransform();
            drawUvEditor();
        });
        uvEditorCanvas.addEventListener('mouseup', function() {
            isDragging = false;
        });
        uvEditorCanvas.addEventListener('mouseleave', function() {
            isDragging = false;
        });
        // Touch drag and pinch
        uvEditorCanvas.addEventListener('touchstart', function(e) {
            isDragging = true;
            isTouch = true;
            dragStart = getEventPos(e);
            dragStartState = { ...imageState };
            if (e.touches.length === 2) {
                lastTouchDist = Math.hypot(
                    dragStart[0].x - dragStart[1].x,
                    dragStart[0].y - dragStart[1].y
                );
            }
        }, { passive: false });
        uvEditorCanvas.addEventListener('touchmove', function(e) {
            if (!isDragging) return;
            const pos = getEventPos(e);
            if (e.touches.length === 1) {
                // Drag
                const dx = pos[0].x - dragStart[0].x;
                const dy = pos[0].y - dragStart[0].y;
                imageState.position.x = clampPosition(dragStartState.position.x + dx, imageState.scale);
                imageState.position.y = clampPosition(dragStartState.position.y + dy, imageState.scale);
            } else if (e.touches.length === 2) {
                // Pinch to scale
                const dist = Math.hypot(
                    pos[0].x - pos[1].x,
                    pos[0].y - pos[1].y
                );
                let scale = dragStartState.scale * (dist / lastTouchDist);
                scale = Math.max(0.1, Math.min(1.0, scale));
                imageState.scale = scale;
                // Optionally: rotate with two-finger twist (not implemented for simplicity)
            }
            updateTextureTransform();
            drawUvEditor();
            e.preventDefault();
        }, { passive: false });
        uvEditorCanvas.addEventListener('touchend', function(e) {
            isDragging = false;
            lastTouchDist = null;
        });
        // Mouse wheel to scale
        uvEditorCanvas.addEventListener('wheel', function(e) {
            let scale = imageState.scale * (e.deltaY < 0 ? 1.05 : 0.95);
            scale = Math.max(0.1, Math.min(1.0, scale));
            imageState.scale = scale;
            updateTextureTransform();
            drawUvEditor();
            e.preventDefault();
        });
        // Optional: add rotation with keyboard (for demo)
        uvEditorCanvas.addEventListener('keydown', function(e) {
            if (e.key === 'q') {
                imageState.rotation -= 5;
            } else if (e.key === 'e') {
                imageState.rotation += 5;
            }
            updateTextureTransform();
            drawUvEditor();
        });
        uvEditorCanvas.tabIndex = 1; // Make canvas focusable for keyboard

        if (uvEditorBtn && uvEditorModal && uvEditorCanvas) {
            uvEditorBtn.addEventListener('click', function() {
                loadTemplateImg(function() {
                    uvEditorModal.classList.remove('hidden');
                    drawUvEditor();
                });
            });
        }
        if (closeUvEditorBtn && uvEditorModal) {
            closeUvEditorBtn.addEventListener('click', function() {
                uvEditorModal.classList.add('hidden');
            });
        }
        // Redraw UV editor when placement changes
        window.drawUvEditor = drawUvEditor;

    } catch (error) {
        console.error('Error initializing UI:', error);
    }
}

// Unified function to update texture transform based on imageState
function clampPosition(value, scale) {
    return Math.max(scale / 2, Math.min(1 - scale / 2, value));
}

function updateSliderRanges() {
    const scale = imageState.scale;
    if (ui.posXSlider) {
        ui.posXSlider.min = scale / 2;
        ui.posXSlider.max = 1 - scale / 2;
        ui.posXSlider.step = 0.001;
    }
    if (ui.posYSlider) {
        ui.posYSlider.min = scale / 2;
        ui.posYSlider.max = 1 - scale / 2;
        ui.posYSlider.step = 0.001;
    }
}

function updateTextureTransform() {
    if (!currentPrint || !currentPrint.texture) return;
    const scale = Math.max(0.1, Math.min(1.0, imageState.scale));
    // Clamp position so image never moves off shirt
    imageState.position.x = clampPosition(imageState.position.x, scale);
    imageState.position.y = clampPosition(imageState.position.y, scale);
    // Update sliders if needed
    if (ui.posXSlider) ui.posXSlider.value = imageState.position.x;
    if (ui.posYSlider) ui.posYSlider.value = imageState.position.y;
    currentPrint.texture.center.set(0.5, 0.5);
    currentPrint.texture.repeat.set(scale, scale);
    currentPrint.texture.offset.set(imageState.position.x - scale / 2, imageState.position.y - scale / 2);
    currentPrint.texture.rotation = (imageState.rotation * Math.PI) / 180;
    currentPrint.texture.flipY = false;
    currentPrint.texture.needsUpdate = true;
    if (currentPrint.mesh && currentPrint.mesh.material && currentPrint.mesh.material.map) {
        currentPrint.mesh.material.map.center.set(0.5, 0.5);
        currentPrint.mesh.material.map.repeat.set(scale, scale);
        currentPrint.mesh.material.map.offset.set(imageState.position.x - scale / 2, imageState.position.y - scale / 2);
        currentPrint.mesh.material.map.rotation = (imageState.rotation * Math.PI) / 180;
        currentPrint.mesh.material.map.flipY = false;
        currentPrint.mesh.material.map.needsUpdate = true;
    }
    updateSliderRanges();
    console.log('updateTextureTransform', { position: imageState.position, scale: imageState.scale, rotation: imageState.rotation });
}

function updateImagePosition() {
    if (!currentPrint || !currentPrint.texture) return;
    imageState.position.x = clampPosition(parseFloat(ui.posXSlider.value), imageState.scale);
    imageState.position.y = clampPosition(parseFloat(ui.posYSlider.value), imageState.scale);
    updateTextureTransform();
    console.log('updateImagePosition:', imageState.position.x, imageState.position.y);
}

function updateImageScale() {
    if (!currentPrint || !currentPrint.texture) return;
    imageState.scale = Math.max(0.1, Math.min(1.0, parseFloat(ui.scaleSlider.value)));
    // Clamp position to new allowed range
    imageState.position.x = clampPosition(imageState.position.x, imageState.scale);
    imageState.position.y = clampPosition(imageState.position.y, imageState.scale);
    updateTextureTransform();
    console.log('updateImageScale:', imageState.scale);
}

function updateImageRotation() {
    if (!currentPrint || !currentPrint.texture) return;
    imageState.rotation = parseFloat(ui.rotationSlider.value);
    updateTextureTransform();
    console.log('updateImageRotation:', imageState.rotation);
}



function showEditControls() {
    console.log('showEditControls called');
    try {
        if (!currentPrint) {
            console.log('No current print to edit');
            return;
        }
        
        if (!ui.mainControls || !ui.editControls) {
            console.error('UI elements not found');
            return;
        }
        
        console.log('Showing edit controls');
        ui.mainControls.classList.add('hidden');
        ui.editControls.classList.remove('hidden');
        updateSliderValues();
    } catch (error) {
        console.error('Error in showEditControls:', error);
    }
}

function hideEditControls() {
    console.log('hideEditControls called');
    try {
        if (!ui.editControls || !ui.mainControls) {
            console.error('UI elements not found');
            return;
        }
        
        console.log('Hiding edit controls');
        ui.editControls.classList.add('hidden');
        ui.mainControls.classList.remove('hidden');
    } catch (error) {
        console.error('Error in hideEditControls:', error);
    }
}

function updateSliderValues() {
    if (!currentPrint) return;
    
    // Set default values if they don't exist in state
    if (imageState.position === undefined) {
        imageState.position = { x: 0, y: 0 };
    }
    if (imageState.scale === undefined) {
        imageState.scale = 1.0;
    }
    if (imageState.rotation === undefined) {
        imageState.rotation = 0;
    }
    
    // Update slider values from state
    ui.posXSlider.value = imageState.position.x;
    ui.posYSlider.value = imageState.position.y;
    ui.scaleSlider.value = imageState.scale;
    ui.rotationSlider.value = imageState.rotation;
    
    // Update texture properties if they exist
    if (currentPrint.texture) {
        currentPrint.texture.offset.set(imageState.position.x, imageState.position.y);
        currentPrint.texture.repeat.set(1/imageState.scale, 1/imageState.scale);
        currentPrint.texture.rotation = (imageState.rotation * Math.PI) / 180;
        currentPrint.texture.needsUpdate = true;
    }
    
    // Update value displays if they exist
    if (ui.posXValue) ui.posXValue.textContent = imageState.position.x.toFixed(2);
    if (ui.posYValue) ui.posYValue.textContent = imageState.position.y.toFixed(2);
    if (ui.scaleValue) ui.scaleValue.textContent = imageState.scale.toFixed(2);
    if (ui.rotationValue) ui.rotationValue.textContent = Math.round(imageState.rotation);
    
    console.log('Slider values updated:', {
        position: imageState.position,
        scale: imageState.scale,
        rotation: imageState.rotation
    });
}

function updateImagePosition() {
    if (!currentPrint || !currentPrint.texture) return;
    
    const offsetX = parseFloat(ui.posXSlider.value);
    const offsetY = parseFloat(ui.posYSlider.value);
    
    // Update texture offset
    currentPrint.texture.offset.set(offsetX, offsetY);
    currentPrint.texture.needsUpdate = true;
    
    // Update state
    imageState.position = { x: offsetX, y: offsetY };
}

function updateImageScale() {
    if (!currentPrint || !currentPrint.texture) return;
    
    const scale = parseFloat(ui.scaleSlider.value);
    
    // Update texture repeat
    currentPrint.texture.repeat.set(1/scale, 1/scale);
    currentPrint.texture.offset.set(
        (1 - 1/scale) / 2,  // Center the texture when scaling
        (1 - 1/scale) / 2
    );
    currentPrint.texture.needsUpdate = true;
    
    // Update state
    imageState.scale = scale;
}

function updateImageRotation() {
    if (!currentPrint || !currentPrint.texture) return;
    
    const rotation = parseFloat(ui.rotationSlider.value);
    
    // Update texture rotation (in radians)
    currentPrint.texture.rotation = (rotation * Math.PI) / 180;
    currentPrint.texture.needsUpdate = true;
    
    // Update state
    imageState.rotation = rotation;
}

function takeScreenshot() {
    if (isModelLoading) return;
    
    // Temporarily hide controls
    const controls = document.getElementById('controls');
    const wasEditing = !ui.editControls.classList.contains('hidden');
    
    if (wasEditing) {
        hideEditControls();
    } else {
        controls.style.visibility = 'hidden';
    }
    
    // Small delay to ensure UI is hidden before capture
    setTimeout(() => {
        // Use the current renderer with preserveDrawingBuffer
        renderer.domElement.toBlob(function(blob) {
            const link = document.createElement('a');
            link.download = 'tshirt-mockup.png';
            link.href = URL.createObjectURL(blob);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            
            // Show controls again
            if (wasEditing) {
                showEditControls();
            } else {
                controls.style.visibility = 'visible';
            }
        }, 'image/png');
    }, 100);
}

function resetView() {
    // Reset camera position and controls
    if (camera) {
        camera.position.set(0, 0, 2);
    }

    if (controls) {
        controls.reset();
    }

    // Reset image state
    imageState = {
        position: { x: 0, y: 0 },
        scale: 1.0,
        rotation: 0
    };

    // Reset texture if we have a current print
    if (currentPrint && currentPrint.texture) {
        currentPrint.texture.offset.set(0, 0);
        currentPrint.texture.repeat.set(1, 1);
        currentPrint.texture.rotation = 0;
        currentPrint.texture.needsUpdate = true;
    }

    // Reset sliders
    updateSliderValues();

    console.log('View and texture reset');
}

function setupTouchControls() {
    let touchStartX = 0;
    let touchStartY = 0;
    let isDragging = false;

    const container = document.getElementById('container');

    container.addEventListener('touchstart', (e) => {
        if (e.touches.length === 1) {
            touchStartX = e.touches[0].clientX;
            touchStartY = e.touches[0].clientY;
            isDragging = true;
        }
    }, { passive: true });
    
    container.addEventListener('touchmove', (e) => {
        if (!isDragging) return;
        
        const touch = e.touches[0];
        const deltaX = touch.clientX - touchStartX;
        const deltaY = touch.clientY - touchStartY;
        
        if (tshirt) {
            tshirt.rotation.y += deltaX * 0.01;
            tshirt.rotation.x += deltaY * 0.01;
        }
        
        touchStartX = touch.clientX;
        touchStartY = touch.clientY;
        
        e.preventDefault();
    }, { passive: false });
    
    container.addEventListener('touchend', () => {
        isDragging = false;
    }, { passive: true });
    
    // Prevent scrolling when interacting with the 3D model
    container.addEventListener('touchmove', (e) => {
        if (isDragging) {
            e.preventDefault();
        }
    }, { passive: false });
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

function animate() {
    requestAnimationFrame(animate);
    
    if (controls) {
        controls.update();
    }
    
    renderer.render(scene, camera);
}

// Handle window resize
window.addEventListener('resize', onWindowResize, false);

// Initialize the application
function init() {
    console.log('Initializing application...');
    
    try {
        // Create scene
        scene = new THREE.Scene();
        scene.background = new THREE.Color(0xf0f0f0);
        
        // Create camera with adjusted position and FOV
        camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 1000);
        camera.position.set(2, 2, 5);
        camera.lookAt(0, 0, 0);
        
        // Create renderer with better settings
        renderer = new THREE.WebGLRenderer({ 
            antialias: true, 
            alpha: true,
            powerPreference: 'high-performance'
        });
        
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        renderer.outputEncoding = THREE.sRGBEncoding;
        renderer.shadowMap.enabled = true;
        
        const container = document.getElementById('container');
        container.innerHTML = ''; // Clear any existing content
        container.appendChild(renderer.domElement);
        
        // Add stats for debugging
        const stats = new Stats();
        stats.showPanel(0); // 0: fps, 1: ms, 2: mb, 3+: custom
        document.body.appendChild(stats.dom);
        
        // Add animation loop with stats
        const animate = () => {
            requestAnimationFrame(animate);
            
            if (controls) {
                controls.update();
            }
            
            stats.begin();
            renderer.render(scene, camera);
            stats.end();
        };
        
        // Start animation loop
        animate();
        
        // Add better lighting setup
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
        scene.add(ambientLight);
        
        // Main directional light
        const mainLight = new THREE.DirectionalLight(0xffffff, 0.8);
        mainLight.position.set(1, 1, 1).normalize();
        scene.add(mainLight);
        
        // Fill light
        const fillLight = new THREE.DirectionalLight(0xffffff, 0.5);
        fillLight.position.set(-1, 0.5, 1).normalize();
        scene.add(fillLight);
        
        // Back light
        const backLight = new THREE.DirectionalLight(0xffffff, 0.5);
        backLight.position.set(0.5, 0.5, -1).normalize();
        scene.add(backLight);
        
        // Add orbit controls
        controls = new THREE.OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true;
        controls.dampingFactor = 0.05;
        controls.enablePan = false;
        controls.maxPolarAngle = Math.PI / 1.5;
        controls.minDistance = 1.5;
        controls.maxDistance = 3;
        
        // Handle window resize
        window.addEventListener('resize', onWindowResize, false);
        
        // Initialize UI
        initUI();
        
        // Load the model
        loadModel();
        
        // Start animation loop
        animate();
        
        console.log('Application initialized');
    } catch (error) {
        console.error('Error initializing application:', error);
        const loading = document.getElementById('loading');
        if (loading) {
            loading.innerHTML = '<h2>Error initializing application. Please check console for details.</h2>';
        }
    }
}

// Animation loop
function animate() {
    requestAnimationFrame(animate);
    
    if (controls) {
        controls.update();
    }
    
    renderer.render(scene, camera);
}

// Handle window resize
function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

// Helper function to get WebGL error string
function getGLErrorString(gl, error) {
    const errorMap = {
        [gl.NO_ERROR]: 'NO_ERROR',
        [gl.INVALID_ENUM]: 'INVALID_ENUM',
        [gl.INVALID_VALUE]: 'INVALID_VALUE',
        [gl.INVALID_OPERATION]: 'INVALID_OPERATION',
        [gl.INVALID_FRAMEBUFFER_OPERATION]: 'INVALID_FRAMEBUFFER_OPERATION',
        [gl.OUT_OF_MEMORY]: 'OUT_OF_MEMORY',
        [gl.CONTEXT_LOST_WEBGL]: 'CONTEXT_LOST_WEBGL'
    };
    return errorMap[error] || `Unknown error code: ${error}`;
}

// Add a grid helper to the scene
function addGridHelper() {
    const gridHelper = new THREE.GridHelper(10, 10, 0x888888, 0x444444);
    scene.add(gridHelper);
    
    // Add axes helper
    const axesHelper = new THREE.AxesHelper(5);
    scene.add(axesHelper);
}

// Start the application when the page loads
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    // DOM is already ready
    setTimeout(init, 0);
}
