// Scene setup
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xf0f0f0);

// Camera setup
const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 0, 1.5);

// Renderer setup
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
document.getElementById('canvas-container').prepend(renderer.domElement);

// Add lights
const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
directionalLight.position.set(1, 1, 1);
scene.add(directionalLight);

// Add a second light from the opposite side
const directionalLight2 = new THREE.DirectionalLight(0xffffff, 0.5);
directionalLight2.position.set(-1, -1, -1);
scene.add(directionalLight2);

// Controls
const controls = new THREE.OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.05;
controls.minDistance = 1;
controls.maxDistance = 3;
controls.enablePan = false;
controls.autoRotate = true;
controls.autoRotateSpeed = 0.5;

// T-shirt material
let tshirtMaterial = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.7,
    metalness: 0.2
});

// T-shirt model
let tshirt;
// const modelUrl = './scene.gltf'; // Using the local GLTF file
const modelUrl = './Tshirt.glb'; // Use the new, properly UV-unwrapped model

// Set up loading manager for better feedback
const loadingManager = new THREE.LoadingManager();
loadingManager.onProgress = function (url, itemsLoaded, itemsTotal) {
    const percent = Math.round((itemsLoaded / itemsTotal) * 100);
    document.getElementById('loading').textContent = `Loading model... ${percent}%`;
};

const loader = new THREE.GLTFLoader(loadingManager);

// Add debug axes helper
const axesHelper = new THREE.AxesHelper(5);
scene.add(axesHelper);

// Add grid helper
const gridHelper = new THREE.GridHelper(10, 10);
scene.add(gridHelper);

loader.load(
    modelUrl,
    function (gltf) {
        console.log('Model loaded successfully:', gltf);
        tshirt = gltf.scene;
        
        // Log scene hierarchy for debugging
        console.log('Scene hierarchy:', tshirt);
        
        // Make sure the scene is added to the scene
        if (!tshirt) {
            console.error('No scene found in the GLTF file');
            document.getElementById('loading').innerHTML = 'Error: No 3D model found in the file';
            return;
        }
        
        // Calculate bounding box to center the model
        const box = new THREE.Box3().setFromObject(tshirt);
        
        // Check if the box is valid
        if (box.isEmpty()) {
            console.warn('Model bounding box is empty, the model might be too small or not visible');
            // Try to make it visible by setting a default size
            tshirt.scale.set(1, 1, 1);
            tshirt.position.set(0, 0, 0);
        } else {
            const center = box.getCenter(new THREE.Vector3());
            console.log('Model center:', center);
            
            // Position the model at the center
            tshirt.position.x = -center.x;
            tshirt.position.y = -center.y + 0.1; // Raise the shirt a bit
            tshirt.position.z = -center.z;
            
            // Calculate scale to fit the view
            const size = box.getSize(new THREE.Vector3()).length();
            console.log('Model size:', size);
            
            const maxDim = Math.max(size, 0.1); // Ensure we don't divide by zero
            const scale = 1.5 / maxDim;
            tshirt.scale.set(scale, scale, scale);
            
            // Adjust camera distance based on model size
            camera.position.z = size * 2.5;
            controls.target.copy(center);
        }
        
        // Apply material to all meshes while preserving textures
        let meshCount = 0;
        tshirt.traverse((child) => {
            if (child.isMesh) {
                meshCount++;
                console.log('Found mesh:', child.name || 'unnamed');
                
                // Create a copy of the original material or use a new one
                const material = new THREE.MeshStandardMaterial({
                    color: 0x00ff00, // Bright green to make it visible
                    wireframe: true, // Show wireframe to help with debugging
                    side: THREE.DoubleSide,
                    transparent: true,
                    opacity: 0.8
                });
                
                // If the original material has a texture, use it
                if (child.material && child.material.map) {
                    material.map = child.material.map;
                    material.wireframe = false;
                    material.opacity = 1.0;
                }
                
                child.material = material;
                child.castShadow = true;
                child.receiveShadow = true;
            }
        });
        
        console.log(`Found ${meshCount} meshes in the model`);
        
        if (meshCount === 0) {
            console.warn('No meshes found in the model');
        }
        
        scene.add(tshirt);
        
        // Auto-rotate the model
        controls.autoRotate = true;
        controls.autoRotateSpeed = 1.0;
        
        // Update controls
        controls.update();
        
        // Hide loading screen after a short delay to ensure everything is rendered
        setTimeout(() => {
            document.getElementById('loading').style.display = 'none';
        }, 500);
    },
    // Progress callback
    function (xhr) {
        const percentComplete = (xhr.loaded / xhr.total) * 100;
        console.log(percentComplete.toFixed(2) + '% loaded');
    },
    // Error callback
    function (error) {
        console.error('An error occurred loading the 3D model:', error);
        document.getElementById('loading').innerHTML = `
            Error loading 3D model: ${error.message || 'Unknown error'}<br>
            Please check the browser console for details.<br>
            Make sure all required files (.bin, textures) are in the same folder as scene.gltf
        `;
    }
);

// Handle window resize
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

// Update color picker to work with real-time updates
document.getElementById('color-picker').addEventListener('input', (e) => {
    if (!tshirt) return;
    
    const color = new THREE.Color(e.target.value);
    
    tshirt.traverse((child) => {
        if (child.isMesh) {
            // Keep the material but update its color
            child.material.color.copy(color);
            
            // Update material properties for better appearance
            child.material.needsUpdate = true;
        }
    });
});

// Reset view
document.getElementById('reset').addEventListener('click', () => {
    if (!tshirt) return;
    
    // Reset camera
    camera.position.set(0, 0, 1.5);
    controls.reset();
    
    // Reset to white
    const white = new THREE.Color(0xffffff);
    tshirt.traverse((child) => {
        if (child.isMesh) {
            child.material.color.copy(white);
            child.material.needsUpdate = true;
        }
    });
    
    // Reset color picker
    document.getElementById('color-picker').value = '#ffffff';
});

// Add auto-rotation toggle
document.getElementById('toggle-rotation').addEventListener('click', function() {
    controls.autoRotate = !controls.autoRotate;
    this.textContent = controls.autoRotate ? 'Pause Rotation' : 'Start Rotation';
});

// Add fullscreen button
document.getElementById('fullscreen').addEventListener('click', () => {
    if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(err => {
            console.error('Error attempting to enable fullscreen:', err);
        });
    } else {
        if (document.exitFullscreen) {
            document.exitFullscreen();
        }
    }
});

// --- Drag and Drop Image Projection ---
const canvasContainer = document.getElementById('canvas-container');

canvasContainer.addEventListener('dragover', (e) => {
    e.preventDefault();
    canvasContainer.style.outline = '2px dashed #4CAF50';
});
canvasContainer.addEventListener('dragleave', (e) => {
    e.preventDefault();
    canvasContainer.style.outline = '';
});
canvasContainer.addEventListener('drop', (e) => {
    e.preventDefault();
    canvasContainer.style.outline = '';
    if (!tshirt) return;
    const file = e.dataTransfer.files[0];
    if (!file || !file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = function(evt) {
        const img = new window.Image();
        img.onload = function() {
            const texture = new THREE.Texture(img);
            texture.needsUpdate = true;
            // Project as a shrinkwrapped decal on the shirt
            projectDecalOnShirt(texture);
        };
        img.src = evt.target.result;
    };
    reader.readAsDataURL(file);
});

function projectDecalOnShirt(texture) {
    // Find the largest mesh (main shirt body)
    let mainMesh = null;
    let maxArea = 0;
    tshirt.traverse(child => {
        if (child.isMesh) {
            if (!child.geometry.boundingBox) child.geometry.computeBoundingBox();
            const area = child.geometry.boundingBox ? child.geometry.boundingBox.getSize(new THREE.Vector3()).length() : 0;
            if (area > maxArea) {
                maxArea = area;
                mainMesh = child;
            }
        }
    });
    if (!mainMesh) return;
    // Center front of the shirt
    const box = mainMesh.geometry.boundingBox;
    const decalPosition = new THREE.Vector3(0, 0, box.max.z + 0.01);
    mainMesh.localToWorld(decalPosition);
    const decalSize = new THREE.Vector3(0.25, 0.25, 0.01); // Adjust as needed
    const decal = new THREE.Mesh(
        new THREE.DecalGeometry(mainMesh, decalPosition, new THREE.Euler(0, 0, 0), decalSize),
        new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthTest: true, depthWrite: false })
    );
    scene.add(decal);
}

// --- Decal Controls ---
let decalTexture = null;
let decalMesh = null;
let decalParams = {
    x: 0,
    y: 0,
    z: null, // will be set to the front of the shirt
    scale: 0.25,
    rotation: 0
};

function createOrUpdateDecal(texture) {
    if (decalMesh) {
        scene.remove(decalMesh);
        decalMesh.geometry.dispose();
        decalMesh.material.dispose();
        decalMesh = null;
    }
    let mainMesh = null;
    let maxArea = 0;
    tshirt.traverse(child => {
        if (child.isMesh) {
            if (!child.geometry.boundingBox) child.geometry.computeBoundingBox();
            const area = child.geometry.boundingBox ? child.geometry.boundingBox.getSize(new THREE.Vector3()).length() : 0;
            if (area > maxArea) {
                maxArea = area;
                mainMesh = child;
            }
        }
    });
    if (!mainMesh) return;
    const box = mainMesh.geometry.boundingBox;
    if (decalParams.z === null) decalParams.z = box.max.z + 0.01;
    // Decal position in local mesh space
    const decalPosition = new THREE.Vector3(decalParams.x, decalParams.y, decalParams.z);
    mainMesh.localToWorld(decalPosition);
    const decalSize = new THREE.Vector3(decalParams.scale, decalParams.scale, 0.01);
    const decalEuler = new THREE.Euler(0, 0, decalParams.rotation);
    decalMesh = new THREE.Mesh(
        new THREE.DecalGeometry(mainMesh, decalPosition, decalEuler, decalSize),
        new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthTest: true, depthWrite: false })
    );
    scene.add(decalMesh);
}

canvasContainer.addEventListener('drop', (e) => {
    e.preventDefault();
    canvasContainer.style.outline = '';
    if (!tshirt) return;
    const file = e.dataTransfer.files[0];
    if (!file || !file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = function(evt) {
        const img = new window.Image();
        img.onload = function() {
            decalTexture = new THREE.Texture(img);
            decalTexture.needsUpdate = true;
            decalParams = { x: 0, y: 0, z: null, scale: 0.25, rotation: 0 };
            createOrUpdateDecal(decalTexture);
        };
        img.src = evt.target.result;
    };
    reader.readAsDataURL(file);
});

document.addEventListener('keydown', (e) => {
    if (!decalMesh) return;
    let changed = false;
    switch (e.key) {
        case 'ArrowUp': decalParams.y += 0.02; changed = true; break;
        case 'ArrowDown': decalParams.y -= 0.02; changed = true; break;
        case 'ArrowLeft': decalParams.x -= 0.02; changed = true; break;
        case 'ArrowRight': decalParams.x += 0.02; changed = true; break;
        case '+': case '=': decalParams.scale *= 1.1; changed = true; break;
        case '-': decalParams.scale /= 1.1; changed = true; break;
        case 'r': decalParams.rotation += Math.PI / 18; changed = true; break; // rotate 10deg
        case 'R': decalParams.rotation -= Math.PI / 18; changed = true; break;
    }
    if (changed) {
        createOrUpdateDecal(decalTexture);
    }
});

// --- VirtualThreads-style Image Projection ---
// Initialize design canvas
const designCanvas = document.createElement('canvas');
designCanvas.width = 1024;
designCanvas.height = 1024;
const designCtx = designCanvas.getContext('2d');

// Use the preloaded template image from the window object
const uvTemplate = window.templateImage || new Image();
console.log('Using preloaded template image:', uvTemplate.src, 
            'Loaded:', uvTemplate.complete, 
            'Dimensions:', uvTemplate.width, 'x', uvTemplate.height);

// If the image isn't loaded yet, set up the event handlers
if (!uvTemplate.complete) {
    uvTemplate.onload = function() {
        console.log('Template image loaded successfully', 
                   'Dimensions:', uvTemplate.width, 'x', uvTemplate.height);
        updateDesignCanvas();
    };
    
    uvTemplate.onerror = function(e) {
        console.error('Failed to load template image', e);
        console.error('Attempted to load from:', uvTemplate.src);
    };
} else {
    // If already loaded, update the canvas immediately
    setTimeout(updateDesignCanvas, 100);
}

// Initialize design parameters
const designParams = { x: 512, y: 512, scale: 512, rotation: 0 };

// Create a texture from the canvas
let designTexture = new THREE.Texture(designCanvas);

designTexture.needsUpdate = true;

// Create a buffer canvas to preserve the template
const bufferCanvas = document.createElement('canvas');
bufferCanvas.width = designCanvas.width;
bufferCanvas.height = designCanvas.height;
const bufferCtx = bufferCanvas.getContext('2d');

// Create a buffer canvas to preserve the template
const templateBuffer = document.createElement('canvas');
templateBuffer.width = designCanvas.width;
templateBuffer.height = designCanvas.height;
const templateCtx = templateBuffer.getContext('2d');

// Draw the template once to the buffer
function initializeTemplate() {
    if (uvTemplate.complete && uvTemplate.naturalWidth > 0) {
        // Draw template with grid and crosshairs to buffer
        templateCtx.fillStyle = '#ffffff';
        templateCtx.fillRect(0, 0, templateBuffer.width, templateBuffer.height);
        
        // Draw template image
        templateCtx.globalAlpha = 0.7;
        templateCtx.drawImage(uvTemplate, 0, 0, templateBuffer.width, templateBuffer.height);
        templateCtx.globalAlpha = 1.0;
        
        // Draw grid
        templateCtx.strokeStyle = 'rgba(200, 200, 200, 0.3)';
        templateCtx.lineWidth = 1;
        for (let i = 0; i <= 10; i++) {
            // Vertical lines
            templateCtx.beginPath();
            templateCtx.moveTo(i * 102.4, 0);
            templateCtx.lineTo(i * 102.4, 1024);
            templateCtx.stroke();
            // Horizontal lines
            templateCtx.beginPath();
            templateCtx.moveTo(0, i * 102.4);
            templateCtx.lineTo(1024, i * 102.4);
            templateCtx.stroke();
        }
        
        // Draw center cross
        templateCtx.strokeStyle = 'rgba(255, 0, 0, 0.5)';
        templateCtx.lineWidth = 2;
        templateCtx.beginPath();
        templateCtx.moveTo(512, 0);
        templateCtx.lineTo(512, 1024);
        templateCtx.moveTo(0, 512);
        templateCtx.lineTo(1024, 512);
        templateCtx.stroke();
    }
}

function updateDesignCanvas() {
    // Clear the design canvas with white
    designCtx.fillStyle = '#ffffff';
    designCtx.fillRect(0, 0, designCanvas.width, designCanvas.height);
    
    // Always redraw the template first
    if (uvTemplate.complete && uvTemplate.naturalWidth > 0) {
        // Draw template directly
        designCtx.globalAlpha = 0.7;
        designCtx.drawImage(uvTemplate, 0, 0, designCanvas.width, designCanvas.height);
        designCtx.globalAlpha = 1.0;
    }
    
    // Save the current canvas state
    designCtx.save();
    
    // Apply any transformations for the current design
    if (designImage) {
        const centerX = designParams.x;
        const centerY = designParams.y;
        const scale = designParams.scale / 1024; // Normalize scale
        const rotation = designParams.rotation;
        
        // Move to center of image
        designCtx.translate(centerX, centerY);
        // Rotate around center
        designCtx.rotate(rotation);
        // Scale
        designCtx.scale(scale, scale);
        // Draw image centered
        designCtx.drawImage(designImage, -designImage.width/2, -designImage.height/2);
    }
    
    // Restore the canvas state
    designCtx.restore();
    
    // Update the texture
    designTexture.needsUpdate = true;
    
    // Draw a grid for UV debugging (less prominent now that we have the template)
    designCtx.strokeStyle = 'rgba(200, 200, 200, 0.3)';
    designCtx.lineWidth = 1;
    for (let i = 0; i <= 10; i++) {
        // Vertical lines
        designCtx.beginPath();
        designCtx.moveTo(i * 102.4, 0);
        designCtx.lineTo(i * 102.4, 1024);
        designCtx.stroke();
        // Horizontal lines
        designCtx.beginPath();
        designCtx.moveTo(0, i * 102.4);
        designCtx.lineTo(1024, i * 102.4);
        designCtx.stroke();
    }
    
    // Draw center cross (less prominent)
    designCtx.strokeStyle = 'rgba(255, 0, 0, 0.5)';
    designCtx.lineWidth = 2;
    designCtx.beginPath();
    designCtx.moveTo(512, 0);
    designCtx.lineTo(512, 1024);
    designCtx.moveTo(0, 512);
    designCtx.lineTo(1024, 512);
    designCtx.stroke();
    
    // Draw the image (fully opaque)
    if (designImage) {
        designCtx.save();
        designCtx.globalAlpha = 1.0; // Ensure image is fully opaque
        designCtx.translate(designParams.x, designParams.y);
        designCtx.rotate(designParams.rotation);
        designCtx.drawImage(
            designImage,
            -designParams.scale / 2,
            -designParams.scale / 2,
            designParams.scale,
            designParams.scale
        );
        designCtx.restore();
    }
    
    designTexture.needsUpdate = true;
    
    // Update the design preview if the function exists
    if (typeof updateDesignPreview === 'function') {
        updateDesignPreview();
    }
}

function applyDesignTextureToShirt() {
    // Find main mesh
    let mainMesh = null;
    let maxArea = 0;
    tshirt.traverse(child => {
        if (child.isMesh) {
            if (!child.geometry.boundingBox) child.geometry.computeBoundingBox();
            const area = child.geometry.boundingBox ? child.geometry.boundingBox.getSize(new THREE.Vector3()).length() : 0;
            if (area > maxArea) {
                maxArea = area;
                mainMesh = child;
            }
        }
    });
    if (!mainMesh) return;
    // Force material to MeshStandardMaterial with map
    mainMesh.material = new THREE.MeshStandardMaterial({
        map: designTexture,
        color: 0xffffff,
        roughness: 0.7,
        metalness: 0.2
    });
    mainMesh.material.needsUpdate = true;
}

canvasContainer.addEventListener('drop', (e) => {
    e.preventDefault();
    canvasContainer.style.outline = '';
    if (!tshirt) return;
    const file = e.dataTransfer.files[0];
    if (!file || !file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = function(evt) {
        const img = new window.Image();
        img.onload = function() {
            designImage = img;
            designParams = { x: 512, y: 512, scale: 512, rotation: 0 };
            updateDesignCanvas();
            applyDesignTextureToShirt();
            // Debug: show the canvas in the DOM for troubleshooting
            if (!document.getElementById('debug-canvas')) {
                designCanvas.id = 'debug-canvas';
                designCanvas.style.position = 'fixed';
                designCanvas.style.bottom = '10px';
                designCanvas.style.right = '10px';
                designCanvas.style.width = '200px';
                designCanvas.style.height = '200px';
                designCanvas.style.zIndex = 9999;
                document.body.appendChild(designCanvas);
            }
        };
        img.onerror = function() {
            alert('Failed to load image.');
        };
        img.src = evt.target.result;
    };
    reader.readAsDataURL(file);
});

// Function to create or update the design preview with template background
function updateDesignPreview() {
    let previewPanel = document.getElementById('design-preview');
    if (!previewPanel) {
        // Create the preview panel if it doesn't exist
        previewPanel = document.createElement('div');
        previewPanel.id = 'design-preview';
        previewPanel.style.position = 'fixed';
        previewPanel.style.bottom = '20px';
        previewPanel.style.right = '20px';
        previewPanel.style.width = '200px';
        previewPanel.style.height = '200px';
        previewPanel.style.backgroundColor = 'white';
        previewPanel.style.border = '2px solid #333';
        previewPanel.style.borderRadius = '8px';
        previewPanel.style.overflow = 'hidden';
        previewPanel.style.zIndex = '1000';
        
        const previewTitle = document.createElement('div');
        previewTitle.textContent = 'Design Preview';
        previewTitle.style.padding = '5px';
        previewTitle.style.background = '#333';
        previewTitle.style.color = 'white';
        previewTitle.style.textAlign = 'center';
        previewTitle.style.fontWeight = 'bold';
        previewTitle.style.fontSize = '14px';
        
        // Create a container for the preview with template background
        const previewContainer = document.createElement('div');
        previewContainer.id = 'preview-container';
        previewContainer.style.width = '100%';
        previewContainer.style.height = 'calc(100% - 28px)';
        previewContainer.style.position = 'relative';
        previewContainer.style.backgroundImage = 'url("template.png")';
        previewContainer.style.backgroundSize = 'contain';
        previewContainer.style.backgroundPosition = 'center';
        previewContainer.style.backgroundRepeat = 'no-repeat';
        previewContainer.style.backgroundColor = 'white';
        
        // Create canvas for the design overlay
        const canvas = document.createElement('canvas');
        canvas.id = 'preview-canvas';
        canvas.style.position = 'absolute';
        canvas.style.top = '0';
        canvas.style.left = '0';
        canvas.style.width = '100%';
        canvas.style.height = '100%';
        
        previewContainer.appendChild(canvas);
        previewPanel.appendChild(previewTitle);
        previewPanel.appendChild(previewContainer);
        document.body.appendChild(previewPanel);
    }
    
    // Update the preview canvas with the current design
    const previewCanvas = document.getElementById('preview-canvas');
    if (previewCanvas) {
        const ctx = previewCanvas.getContext('2d');
        const container = document.getElementById('preview-container');
        
        // Set canvas size to match displayed size
        const rect = container.getBoundingClientRect();
        previewCanvas.width = rect.width * window.devicePixelRatio;
        previewCanvas.height = rect.height * window.devicePixelRatio;
        previewCanvas.style.width = '100%';
        previewCanvas.style.height = '100%';
        
        // Scale the context to ensure crisp rendering on high-DPI displays
        const scale = window.devicePixelRatio;
        ctx.scale(scale, scale);
        
        // Clear and redraw the design
        ctx.clearRect(0, 0, previewCanvas.width, previewCanvas.height);
        
        // Draw the design canvas content
        const img = new Image();
        img.onload = function() {
            // Calculate dimensions to maintain aspect ratio
            const containerAspect = container.clientWidth / container.clientHeight;
            const imgAspect = designCanvas.width / designCanvas.height;
            
            let drawWidth, drawHeight, offsetX = 0, offsetY = 0;
            
            if (containerAspect > imgAspect) {
                // Container is wider than the image
                drawHeight = container.clientHeight;
                drawWidth = drawHeight * imgAspect;
                offsetX = (container.clientWidth - drawWidth) / 2;
            } else {
                // Container is taller than the image
                drawWidth = container.clientWidth;
                drawHeight = drawWidth / imgAspect;
                offsetY = (container.clientHeight - drawHeight) / 2;
            }
            
            // Draw the design canvas content
            ctx.drawImage(designCanvas, 0, 0, designCanvas.width, designCanvas.height, 
                         offsetX, offsetY, drawWidth, drawHeight);
        };
        img.src = designCanvas.toDataURL();
    }
}

// --- VirtualThreads-style Multi-Image Projection ---
const MAX_IMAGES = 4;
let designImages = [];
let designParamsArr = [];
let selectedImageIndex = 0;

function updateDesignCanvas() {
    // Clear
    designCtx.fillStyle = '#ffffff';
    designCtx.fillRect(0, 0, designCanvas.width, designCanvas.height);
    // Draw a grid for UV debugging
    designCtx.strokeStyle = '#cccccc';
    designCtx.lineWidth = 2;
    for (let i = 0; i <= 10; i++) {
        // Vertical lines
        designCtx.beginPath();
        designCtx.moveTo(i * 102.4, 0);
        designCtx.lineTo(i * 102.4, 1024);
        designCtx.stroke();
        // Horizontal lines
        designCtx.beginPath();
        designCtx.moveTo(0, i * 102.4);
        designCtx.lineTo(1024, i * 102.4);
        designCtx.stroke();
    }
    // Draw a red cross at the center
    designCtx.strokeStyle = '#ff0000';
    designCtx.beginPath();
    designCtx.moveTo(512, 0);
    designCtx.lineTo(512, 1024);
    designCtx.moveTo(0, 512);
    designCtx.lineTo(1024, 512);
    designCtx.stroke();
    // Draw all images
    for (let i = 0; i < designImages.length; i++) {
        const img = designImages[i];
        const params = designParamsArr[i];
        if (!img) continue;
        designCtx.save();
        designCtx.translate(params.x, params.y);
        designCtx.rotate(params.rotation);
        designCtx.globalAlpha = (i === selectedImageIndex) ? 1 : 0.7;
        designCtx.drawImage(
            img,
            -params.scale / 2,
            -params.scale / 2,
            params.scale,
            params.scale
        );
        // Draw a border for the selected image
        if (i === selectedImageIndex) {
            designCtx.strokeStyle = '#00ff00';
            designCtx.lineWidth = 6;
            designCtx.strokeRect(-params.scale / 2, -params.scale / 2, params.scale, params.scale);
        }
        designCtx.restore();
    }
    designTexture.needsUpdate = true;
}

canvasContainer.addEventListener('drop', (e) => {
    e.preventDefault();
    canvasContainer.style.outline = '';
    if (!tshirt) return;
    const file = e.dataTransfer.files[0];
    if (!file || !file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = function(evt) {
        const img = new window.Image();
        img.onload = function() {
            if (designImages.length < MAX_IMAGES) {
                designImages.push(img);
                designParamsArr.push({ x: 512, y: 512, scale: 512, rotation: 0 });
                selectedImageIndex = designImages.length - 1;
            } else {
                // Replace the selected image
                designImages[selectedImageIndex] = img;
                designParamsArr[selectedImageIndex] = { x: 512, y: 512, scale: 512, rotation: 0 };
            }
            updateDesignCanvas();
            applyDesignTextureToShirt();
            // Debug: show the canvas in the DOM for troubleshooting
            if (!document.getElementById('debug-canvas')) {
                designCanvas.id = 'debug-canvas';
                designCanvas.style.position = 'fixed';
                designCanvas.style.bottom = '10px';
                designCanvas.style.right = '10px';
                designCanvas.style.width = '200px';
                designCanvas.style.height = '200px';
                designCanvas.style.zIndex = 9999;
                document.body.appendChild(designCanvas);
            }
        };
        img.onerror = function() {
            alert('Failed to load image.');
        };
        img.src = evt.target.result;
    };
    reader.readAsDataURL(file);
});

document.addEventListener('keydown', (e) => {
    if (designImages.length === 0) return;
    let changed = false;
    let params = designParamsArr[selectedImageIndex];
    switch (e.key) {
        case 'ArrowUp': params.y -= 20; changed = true; break;
        case 'ArrowDown': params.y += 20; changed = true; break;
        case 'ArrowLeft': params.x -= 20; changed = true; break;
        case 'ArrowRight': params.x += 20; changed = true; break;
        case '+': case '=': params.scale *= 1.1; changed = true; break;
        case '-': params.scale /= 1.1; changed = true; break;
        case 'r': params.rotation += Math.PI / 18; changed = true; break;
        case 'R': params.rotation -= Math.PI / 18; changed = true; break;
        case 'Tab':
            selectedImageIndex = (selectedImageIndex + 1) % designImages.length;
            changed = true;
            e.preventDefault();
            break;
        case 'Delete':
            designImages.splice(selectedImageIndex, 1);
            designParamsArr.splice(selectedImageIndex, 1);
            if (selectedImageIndex >= designImages.length) selectedImageIndex = designImages.length - 1;
            changed = true;
            break;
    }
    if (changed) {
        updateDesignCanvas();
        applyDesignTextureToShirt();
    }
});

// --- Image Editor UI ---
const editorWindow = document.createElement('div');
editorWindow.id = 'image-editor-window';
editorWindow.style.position = 'fixed';
editorWindow.style.top = '40px';
editorWindow.style.right = '40px';
editorWindow.style.width = '320px';
editorWindow.style.height = '420px';
editorWindow.style.border = '2px solid #333';
editorWindow.style.borderRadius = '16px';
editorWindow.style.boxShadow = '0 4px 24px rgba(0,0,0,0.25)';
editorWindow.style.zIndex = 10000;
editorWindow.style.display = 'flex';
editorWindow.style.flexDirection = 'column';
editorWindow.style.alignItems = 'center';
editorWindow.style.padding = '18px 10px 10px 10px';
editorWindow.style.gap = '10px';
editorWindow.style.overflow = 'hidden';

// Create a container for the editor content
const editorContent = document.createElement('div');
editorContent.style.position = 'relative';
editorContent.style.width = '100%';
editorContent.style.height = '100%';
editorContent.style.display = 'flex';
editorContent.style.flexDirection = 'column';

// Create the template background
const templateBg = document.createElement('div');
templateBg.id = 'editor-template-bg';
templateBg.style.position = 'absolute';
templateBg.style.top = '0';
templateBg.style.left = '0';
templateBg.style.width = '100%';
templateBg.style.height = '100%';
templateBg.style.backgroundImage = 'url("template.png")';
templateBg.style.backgroundSize = 'contain';
templateBg.style.backgroundPosition = 'center';
templateBg.style.backgroundRepeat = 'no-repeat';
templateBg.style.opacity = '0.7';

// Create a canvas for the design overlay
const editorCanvas = document.createElement('canvas');
editorCanvas.id = 'editor-canvas';
editorCanvas.style.position = 'absolute';
editorCanvas.style.top = '0';
editorCanvas.style.left = '0';
editorCanvas.style.width = '100%';
editorCanvas.style.height = '100%';
editorCanvas.style.pointerEvents = 'none';

// Create a container for the UI elements
const uiContainer = document.createElement('div');
uiContainer.style.position = 'relative';
uiContainer.style.width = '100%';
uiContainer.style.height = '100%';
uiContainer.style.display = 'flex';
uiContainer.style.flexDirection = 'column';
uiContainer.style.alignItems = 'center';
uiContainer.style.justifyContent = 'flex-start';
uiContainer.style.gap = '10px';

// Add elements to the editor window
editorContent.appendChild(templateBg);
editorContent.appendChild(editorCanvas);
editorContent.appendChild(uiContainer);
editorWindow.appendChild(editorContent);

// Function to update the editor canvas with the current design
function updateEditorCanvas() {
    const canvas = document.getElementById('editor-canvas');
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    const rect = editorContent.getBoundingClientRect();
    
    // Set canvas size to match displayed size
    canvas.width = rect.width * window.devicePixelRatio;
    canvas.height = rect.height * window.devicePixelRatio;
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    
    // Scale the context to ensure crisp rendering on high-DPI displays
    const scale = window.devicePixelRatio;
    ctx.scale(scale, scale);
    
    // Clear the canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Draw the design canvas content
    if (designCanvas) {
        const img = new Image();
        img.onload = function() {
            // Calculate dimensions to maintain aspect ratio
            const containerAspect = rect.width / rect.height;
            const imgAspect = designCanvas.width / designCanvas.height;
            
            let drawWidth, drawHeight, offsetX = 0, offsetY = 0;
            
            if (containerAspect > imgAspect) {
                // Container is wider than the image
                drawHeight = rect.height;
                drawWidth = drawHeight * imgAspect;
                offsetX = (rect.width - drawWidth) / 2;
            } else {
                // Container is taller than the image
                drawWidth = rect.width;
                drawHeight = drawWidth / imgAspect;
                offsetY = (rect.height - drawHeight) / 2;
            }
            
            // Draw the design canvas content
            ctx.drawImage(designCanvas, 0, 0, designCanvas.width, designCanvas.height, 
                         offsetX, offsetY, drawWidth, drawHeight);
        };
        img.src = designCanvas.toDataURL();
    }
}

// Update the editor canvas whenever the design changes
const originalUpdateDesignCanvas = updateDesignCanvas;
updateDesignCanvas = function() {
    originalUpdateDesignCanvas();
    updateEditorCanvas();
};

// Title
const editorTitle = document.createElement('div');
editorTitle.textContent = 'Shirt Image Editor';
editorTitle.style.fontWeight = 'bold';
editorTitle.style.fontSize = '18px';
editorTitle.style.color = '#222';
editorTitle.style.marginBottom = '8px';
editorWindow.appendChild(editorTitle);

// Image thumbnails
const thumbBar = document.createElement('div');
thumbBar.style.display = 'flex';
thumbBar.style.gap = '8px';
thumbBar.style.marginBottom = '10px';
thumbBar.style.justifyContent = 'center';
thumbBar.style.width = '100%';
for (let i = 0; i < MAX_IMAGES; i++) {
    const thumb = document.createElement('canvas');
    thumb.width = 48;
    thumb.height = 48;
    thumb.style.border = '2px solid #888';
    thumb.style.borderRadius = '6px';
    thumb.style.background = '#fff';
    thumb.style.cursor = 'pointer';
    thumbBar.appendChild(thumb);
    thumb.addEventListener('click', () => {
        if (i < designImages.length) {
            selectedImageIndex = i;
            updateDesignCanvas();
            applyDesignTextureToShirt();
            updateEditorUI();
        }
    });
}
editorWindow.appendChild(thumbBar);

// Controls
const controlsBar = document.createElement('div');
controlsBar.style.display = 'flex';
controlsBar.style.flexDirection = 'column';
controlsBar.style.gap = '8px';
controlsBar.style.width = '100%';
controlsBar.style.alignItems = 'center';

function makeButton(label, onClick) {
    const btn = document.createElement('button');
    btn.textContent = label;
    btn.style.padding = '6px 14px';
    btn.style.border = 'none';
    btn.style.borderRadius = '6px';
    btn.style.background = '#4CAF50';
    btn.style.color = '#fff';
    btn.style.fontWeight = 'bold';
    btn.style.cursor = 'pointer';
    btn.style.fontSize = '14px';
    btn.addEventListener('click', onClick);
    btn.addEventListener('mousedown', e => e.preventDefault());
    return btn;
}

controlsBar.appendChild(makeButton('Move Up', () => { if (designImages.length) { designParamsArr[selectedImageIndex].y -= 20; updateDesignCanvas(); applyDesignTextureToShirt(); updateEditorUI(); } }));
controlsBar.appendChild(makeButton('Move Down', () => { if (designImages.length) { designParamsArr[selectedImageIndex].y += 20; updateDesignCanvas(); applyDesignTextureToShirt(); updateEditorUI(); } }));
controlsBar.appendChild(makeButton('Move Left', () => { if (designImages.length) { designParamsArr[selectedImageIndex].x -= 20; updateDesignCanvas(); applyDesignTextureToShirt(); updateEditorUI(); } }));
controlsBar.appendChild(makeButton('Move Right', () => { if (designImages.length) { designParamsArr[selectedImageIndex].x += 20; updateDesignCanvas(); applyDesignTextureToShirt(); updateEditorUI(); } }));
controlsBar.appendChild(makeButton('Scale +', () => { if (designImages.length) { designParamsArr[selectedImageIndex].scale *= 1.1; updateDesignCanvas(); applyDesignTextureToShirt(); updateEditorUI(); } }));
controlsBar.appendChild(makeButton('Scale -', () => { if (designImages.length) { designParamsArr[selectedImageIndex].scale /= 1.1; updateDesignCanvas(); applyDesignTextureToShirt(); updateEditorUI(); } }));
controlsBar.appendChild(makeButton('Rotate +', () => { if (designImages.length) { designParamsArr[selectedImageIndex].rotation += Math.PI / 18; updateDesignCanvas(); applyDesignTextureToShirt(); updateEditorUI(); } }));
controlsBar.appendChild(makeButton('Rotate -', () => { if (designImages.length) { designParamsArr[selectedImageIndex].rotation -= Math.PI / 18; updateDesignCanvas(); applyDesignTextureToShirt(); updateEditorUI(); } }));
controlsBar.appendChild(makeButton('Delete Image', () => {
    if (designImages.length) {
        designImages.splice(selectedImageIndex, 1);
        designParamsArr.splice(selectedImageIndex, 1);
        if (selectedImageIndex >= designImages.length) selectedImageIndex = designImages.length - 1;
        updateDesignCanvas();
        applyDesignTextureToShirt();
        updateEditorUI();
    }
}));
editorWindow.appendChild(controlsBar);

document.body.appendChild(editorWindow);

function updateEditorUI() {
    // Update thumbnails
    for (let i = 0; i < MAX_IMAGES; i++) {
        const thumb = thumbBar.children[i];
        const ctx = thumb.getContext('2d');
        ctx.clearRect(0, 0, 48, 48);
        if (i < designImages.length) {
            ctx.save();
            ctx.translate(24, 24);
            ctx.rotate(designParamsArr[i].rotation);
            ctx.drawImage(designImages[i], -24, -24, 48, 48);
            ctx.restore();
            if (i === selectedImageIndex) {
                ctx.strokeStyle = '#00ff00';
                ctx.lineWidth = 3;
                ctx.strokeRect(2, 2, 44, 44);
            }
        } else {
            ctx.fillStyle = '#eee';
            ctx.fillRect(0, 0, 48, 48);
        }
    }
}

// Update UI whenever images change
const origUpdateDesignCanvas = updateDesignCanvas;
updateDesignCanvas = function() {
    origUpdateDesignCanvas();
    updateEditorUI();
};

// Create a debug canvas to always show the template
const debugCanvas = document.createElement('canvas');
debugCanvas.id = 'debug-canvas';
debugCanvas.width = 300;  // Slightly smaller for better positioning
debugCanvas.height = 300;
const debugCtx = debugCanvas.getContext('2d');

// Style the debug canvas
debugCanvas.style.position = 'fixed';
debugCanvas.style.bottom = '20px';
debugCanvas.style.right = '20px';
debugCanvas.style.border = '2px solid red';
debugCanvas.style.backgroundColor = 'white';
debugCanvas.style.zIndex = '9999';
debugCanvas.style.boxShadow = '0 0 10px rgba(0,0,0,0.5)';
document.body.appendChild(debugCanvas);

// Add a title to the debug canvas
const debugTitle = document.createElement('div');
debugTitle.textContent = 'Template Reference';
debugTitle.style.position = 'absolute';
debugTitle.style.bottom = (debugCanvas.offsetTop + debugCanvas.height + 5) + 'px';
debugTitle.style.right = '20px';
debugTitle.style.color = 'white';
debugTitle.style.background = 'rgba(0,0,0,0.7)';
debugTitle.style.padding = '5px 10px';
debugTitle.style.borderRadius = '0 0 5px 5px';
debugTitle.style.zIndex = '10000';
document.body.appendChild(debugTitle);

// Function to update the debug canvas
function updateDebugCanvas() {
    // Clear the debug canvas
    debugCtx.fillStyle = '#ffffff';
    debugCtx.fillRect(0, 0, debugCanvas.width, debugCanvas.height);
    
    // Always draw the template in the debug canvas
    if (uvTemplate.complete && uvTemplate.naturalWidth > 0) {
        // Calculate aspect ratio
        const aspect = uvTemplate.width / uvTemplate.height;
        let drawWidth = debugCanvas.width;
        let drawHeight = debugCanvas.width / aspect;
        
        if (drawHeight > debugCanvas.height) {
            drawHeight = debugCanvas.height;
            drawWidth = drawHeight * aspect;
        }
        
        const x = (debugCanvas.width - drawWidth) / 2;
        const y = (debugCanvas.height - drawHeight) / 2;
        
        debugCtx.drawImage(uvTemplate, x, y, drawWidth, drawHeight);
    } else {
        // Show placeholder if template not loaded
        debugCtx.fillStyle = '#f0f0f0';
        debugCtx.fillRect(0, 0, debugCanvas.width, debugCanvas.height);
        debugCtx.fillStyle = '#333';
        debugCtx.font = '14px Arial';
        debugCtx.textAlign = 'center';
        debugCtx.fillText('Template not loaded', debugCanvas.width/2, debugCanvas.height/2);
    }
    
    // Add a border
    debugCtx.strokeStyle = 'red';
    debugCtx.lineWidth = 2;
    debugCtx.strokeRect(0, 0, debugCanvas.width, debugCanvas.height);
}

// Update debug canvas initially and when template loads
updateDebugCanvas();
uvTemplate.onload = function() {
    updateDebugCanvas();
    // Also update the main design canvas
    if (typeof updateDesignCanvas === 'function') {
        updateDesignCanvas();
    }
};

// Update debug canvas periodically to ensure it stays visible
setInterval(updateDebugCanvas, 1000);

// Animation loop
function animate() {
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
}

animate();
