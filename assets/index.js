import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

// Scene setup
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ 
    antialias: true,
    alpha: true,
    logarithmicDepthBuffer: true
});
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setClearColor(0x000000, 0); // Transparent background
document.getElementById('root').appendChild(renderer.domElement);

// Position the renderer's canvas
renderer.domElement.style.position = 'fixed';
renderer.domElement.style.top = '0';
renderer.domElement.style.left = '0';
renderer.domElement.style.zIndex = '2'; // Above UI but below loading screen

// Enhanced lighting
const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight(0xffffff, 1.2);
directionalLight.position.set(5, 5, 5);
directionalLight.castShadow = true;
directionalLight.shadow.mapSize.width = 2048;
directionalLight.shadow.mapSize.height = 2048;
directionalLight.shadow.camera.near = 0.5;
directionalLight.shadow.camera.far = 500;
scene.add(directionalLight);

const pointLight = new THREE.PointLight(0xffffff, 0.8);
pointLight.position.set(0, 5, 0);
scene.add(pointLight);

// Create spotlights for each model
const spotlights = {};
for (let i = 1; i <= 5; i++) {
    const spotlight = new THREE.SpotLight(0xffffff, 0, 0, Math.PI / 4, 0.5, 10);
    spotlight.position.set(0, 5, 5);
    spotlight.castShadow = true;
    scene.add(spotlight);
    spotlights[`model${i}`] = spotlight;
}

// Add mobile detection
const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

// Adjust initial camera and model position
camera.position.z = 4;
if (isMobile) {
    camera.position.y = -0.5; // Move camera down on mobile
}

// Controls
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.05;
controls.enableZoom = false;
controls.enablePan = false;
controls.enabled = false;

let isDragging = false;
let selectedModelForRotation = null;
let previousMouseX = 0;

// Model variables
const models = {
    model1: null,
    model2: null,
    model3: null,
    model4: null,
    model5: null
};

let activeModelIndex = 1;
let hoveredModel = null;
let isTransitioning = false;
let transitionProgress = 0;
let previousModelIndex = 1;

// Load models
const loader = new GLTFLoader();

// Loading management
let loadedModels = 0;
const totalModels = 5;

// Touch variables
let touchStartX = 0;
let touchStartY = 0;
let isSwiping = false;
let isRotating = false;
let lastTouchX = 0;
let touchInstructionTimeout;
let touchStartTime = 0;
let longPressTimeout;
let isLongPress = false;
let touchedModel = null;

let isZoomed = false;
const normalPosition = { y: isMobile ? -0.3 : 0 };
const zoomedPosition = { y: isMobile ? -0.5 : -0.2 }; // Adjusted for mobile
const normalScale = { x: 1, y: 1, z: 1 };
const zoomedScale = { x: 0.95, y: 0.95, z: 0.95 }; // Very subtle scale reduction

// Show touch instruction
const showTouchInstruction = (text) => {
    const instruction = document.querySelector('.touch-instruction');
    instruction.textContent = text;
    instruction.classList.add('visible');
    if (touchInstructionTimeout) clearTimeout(touchInstructionTimeout);
    touchInstructionTimeout = setTimeout(() => {
        instruction.classList.remove('visible');
    }, 1500); // Reduced time to 1.5 seconds
};

// Find model under touch point
const findModelUnderTouch = (touch) => {
    const rect = renderer.domElement.getBoundingClientRect();
    mouse.x = ((touch.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((touch.clientY - rect.top) / rect.height) * 2 + 1;
    
    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObjects(scene.children, true);
    
    if (intersects.length > 0) {
        const object = intersects[0].object;
        if (object.userData.type) {
            return object.userData.type;
        }
    }
    return null;
};

// Handle long press
const handleLongPress = (touch) => {
    if (!touchedModel) return;
    
    isLongPress = true;
    showTouchInstruction('Hold to bring closer');
    hoveredModel = touchedModel;
};

// Touch event handlers
renderer.domElement.addEventListener('touchstart', (event) => {
    if (event.touches.length === 1) {
        const touch = event.touches[0];
        touchStartX = touch.clientX;
        touchStartY = touch.clientY;
        lastTouchX = touch.clientX;
        touchStartTime = Date.now();
        
        // Find the model at touch start
        touchedModel = findModelUnderTouch(touch);
        
        isSwiping = true;
        isRotating = false;
        isLongPress = false;
        
        if (touchedModel) {
            showTouchInstruction('Drag to rotate');
            // Set up long press detection
            if (longPressTimeout) clearTimeout(longPressTimeout);
            longPressTimeout = setTimeout(() => {
                handleLongPress(touch);
            }, 500);
        } else {
            // Show swipe instruction if not touching a model
            showTouchInstruction('Swipe to change models');
        }
    }
}, { passive: true });

renderer.domElement.addEventListener('touchmove', (event) => {
    if (!isSwiping || event.touches.length !== 1) return;
    
    const touch = event.touches[0];
    const deltaX = touch.clientX - touchStartX;
    const deltaY = touch.clientY - touchStartY;
    const moveDistance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
    
    // If significant movement, cancel long press
    if (moveDistance > 10) {
        if (longPressTimeout) {
            clearTimeout(longPressTimeout);
        }
        
        // Start rotation if we have a touched model
        if (touchedModel && !isRotating) {
            isRotating = true;
            hoveredModel = touchedModel;
        }
    }
    
    // Handle rotation
    if (isRotating && touchedModel) {
        const rotationDelta = (touch.clientX - lastTouchX) * 0.01;
        const model = models[touchedModel];
        if (model) {
            model.rotation.y += rotationDelta;
        }
        lastTouchX = touch.clientX;
        event.preventDefault();
    } else if (!isRotating && Math.abs(deltaX) > 50) {
        // Handle swipe
        if (deltaX > 0) {
            handleModelChange('prev');
        } else {
            handleModelChange('next');
        }
        isSwiping = false;
        event.preventDefault();
    }
}, { passive: false });

renderer.domElement.addEventListener('touchend', () => {
    if (longPressTimeout) {
        clearTimeout(longPressTimeout);
    }
    
    isSwiping = false;
    isRotating = false;
    isLongPress = false;
    hoveredModel = null;
    touchedModel = null;
}, { passive: true });

// Prevent default touch behaviors
renderer.domElement.addEventListener('touchmove', (event) => {
    if (touchedModel) {
        event.preventDefault();
    }
}, { passive: false });

// Call adjustForScreenSize after models are loaded
const updateLoadingProgress = () => {
    loadedModels++;
    if (loadedModels === totalModels) {
        const loadingOverlay = document.querySelector('.loading-overlay');
        loadingOverlay.classList.add('hidden');
        adjustForScreenSize();
    }
};

// Error handler for model loading
const handleLoadError = (error) => {
    console.error('Error loading model:', error);
};

// Progress handler for model loading
const handleProgress = (url) => (progress) => {
    if (progress.lengthComputable) {
        const percentComplete = (progress.loaded / progress.total) * 100;
        console.log(`Loading ${url}: ${Math.round(percentComplete)}% complete`);
    }
};

// Function to position model
function positionModel(model) {
    model.position.set(0, isMobile ? -0.3 : 0, 0);
    model.scale.set(1, 1, 1);
}

// Function to load a model
const loadModel = (index, file) => {
    console.log(`Loading model ${index}...`);
    // Get the base URL for GitHub Pages
    const baseUrl = window.location.hostname === 'thenetwork1ng.github.io' 
        ? '/Tshirtphone'
        : '';
        
    return new Promise((resolve, reject) => {
        loader.load(
            `${baseUrl}/models/${index}/${file}`,
            (gltf) => {
                console.log(`Model ${index} loaded successfully`);
                const model = gltf.scene;
                positionModel(model);
                
                // Add environment reflection
                gltf.scene.traverse((child) => {
                if (child.isMesh) {
                        child.userData.type = `model${index}`;
                        if (child.material) {
                            child.material = child.material.clone();
                            child.material.envMapIntensity = 1;
                            child.castShadow = true;
                            child.receiveShadow = true;
                        }
                    }
                });
                
                scene.add(model);
                updateLoadingProgress();
                resolve(model);
            },
            handleProgress(`model${index}.glb`),
            handleLoadError
        );
    });
};

// Load all models
loadModel(1, '1.glb')
.then(model => models.model1 = model)
.catch(handleLoadError);

loadModel(2, '2.glb')
.then(model => models.model2 = model)
.catch(handleLoadError);

loadModel(3, '3.glb')
.then(model => models.model3 = model)
.catch(handleLoadError);

loadModel(4, '4.glb')
.then(model => models.model4 = model)
.catch(handleLoadError);

loadModel(5, 'Untitled.glb')
.then(model => models.model5 = model)
.catch(handleLoadError);

// Raycaster for interaction
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

// Adjust camera and model scale based on screen size
const adjustForScreenSize = () => {
    const isMobile = window.innerWidth < 768;
    camera.position.z = isMobile ? 4 : 3; // Moved camera closer
    
    // Adjust model scale
    Object.values(models).forEach(model => {
        if (model) {
            const scale = isMobile ? 2 : 2.5; // Increased base scale
            model.scale.set(scale, scale, scale);
        }
    });
};

// Handle window resize
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    adjustForScreenSize();
});

// Handle mouse down
renderer.domElement.addEventListener('mousedown', (event) => {
    if (hoveredModel) {
        isDragging = true;
        selectedModelForRotation = hoveredModel;
        previousMouseX = event.clientX;
        document.body.style.cursor = 'grabbing';
    }
});

// Handle mouse move
renderer.domElement.addEventListener('mousemove', (event) => {
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
    
    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObjects(scene.children, true);
    
    if (intersects.length > 0) {
        const object = intersects[0].object;
        if (object.userData.type) {
            if (!isDragging) {
                document.body.style.cursor = 'grab';
            }
            hoveredModel = object.userData.type;
        } else {
            if (!isDragging) {
                document.body.style.cursor = 'default';
            }
            hoveredModel = null;
        }
    } else {
        if (!isDragging) {
            document.body.style.cursor = 'default';
        }
        hoveredModel = null;
    }

    // Handle rotation while dragging
    if (isDragging && selectedModelForRotation) {
        const deltaX = event.clientX - previousMouseX;
        const rotationSpeed = 0.01;
        
        const model = models[selectedModelForRotation];
        if (model) {
            model.rotation.y += deltaX * rotationSpeed;
        }
        
        previousMouseX = event.clientX;
    }
});

// Handle mouse up
renderer.domElement.addEventListener('mouseup', () => {
    isDragging = false;
    selectedModelForRotation = null;
    document.body.style.cursor = hoveredModel ? 'grab' : 'default';
});

// Handle mouse leave
renderer.domElement.addEventListener('mouseleave', () => {
    isDragging = false;
    selectedModelForRotation = null;
    document.body.style.cursor = 'default';
});

// Remove click handler for URLs
window.addEventListener('click', () => {
    if (hoveredModel && !isDragging) {
        // Model was clicked but we're not doing anything with it now
        console.log(`Model ${hoveredModel} clicked`);
    }
});

// Function to trigger transition
const triggerTransition = (newIndex) => {
    if (!isTransitioning && newIndex !== activeModelIndex) {
        isTransitioning = true;
        transitionProgress = 0;
        previousModelIndex = activeModelIndex;
        activeModelIndex = newIndex;

        // Instantly position the new model on the opposite side
        const direction = newIndex > previousModelIndex ? 'next' : 'prev';
        const currentModel = models[`model${previousModelIndex}`];
        const newModel = models[`model${newIndex}`];
        
        if (currentModel && newModel) {
            // For next: current model exits left (-8), new model enters from right (8)
            // For prev: current model exits right (8), new model enters from left (-8)
            if (direction === 'next') {
                newModel.position.x = 8; // New model starts from right
            } else {
                newModel.position.x = -8; // New model starts from left
            }
            newModel.position.z = 0;
        }
    }
};

// Navigation buttons
const createButton = (text, position, onClick) => {
    const button = document.createElement('button');
    button.textContent = text;
    button.style.position = 'absolute';
    button.style.top = '50%';
    button.style.transform = 'translateY(-50%)';
    button.style.padding = '15px 25px';
    button.style.background = 'rgba(0, 0, 0, 0.5)';
    button.style.color = 'white';
    button.style.border = '2px solid rgba(255, 255, 255, 0.2)';
    button.style.borderRadius = '10px';
    button.style.cursor = 'pointer';
    button.style.fontSize = '28px';
    button.style.transition = 'all 0.3s ease';
    button.style.left = position === 'left' ? '20px' : 'auto';
    button.style.right = position === 'right' ? '20px' : 'auto';
    button.style.zIndex = '1000';
    
    button.addEventListener('mouseover', () => {
        button.style.background = 'rgba(255, 255, 255, 0.2)';
        button.style.transform = 'translateY(-50%) scale(1.1)';
    });
    
    button.addEventListener('mouseout', () => {
        button.style.background = 'rgba(0, 0, 0, 0.5)';
        button.style.transform = 'translateY(-50%) scale(1)';
    });
    
    button.addEventListener('click', onClick);
    document.getElementById('root').appendChild(button);
    return button;
};

const handleModelChange = (direction) => {
    if (!isTransitioning) {
        const newIndex = direction === 'next' 
            ? (activeModelIndex % 5) + 1 
            : ((activeModelIndex - 2 + 5) % 5) + 1;

        // Determine if we're looping around
        const isLooping = (direction === 'next' && newIndex === 1) || 
                         (direction === 'prev' && newIndex === 5);

        if (isLooping) {
            // Instantly reposition models for smooth loop
            Object.entries(models).forEach(([key, model]) => {
                if (model) {
                    const index = parseInt(key.replace('model', ''));
                    // Only reposition models that aren't currently visible
                    if (index !== activeModelIndex && index !== newIndex) {
                        if (direction === 'next') {
                            model.position.x = 8;
                            model.position.z = 0;
                        } else {
                            model.position.x = -8;
                            model.position.z = 0;
                        }
                    }
                }
            });
        }

        triggerTransition(newIndex);
    }
};

const prevButton = createButton('←', 'left', () => handleModelChange('prev'));
const nextButton = createButton('→', 'right', () => handleModelChange('next'));

// Create model indicators
const createModelIndicators = () => {
    const container = document.createElement('div');
    container.style.position = 'absolute';
    container.style.bottom = '20px';
    container.style.left = '50%';
    container.style.transform = 'translateX(-50%)';
    container.style.display = 'flex';
    container.style.gap = '10px';
    container.style.zIndex = '1000';

    for (let i = 1; i <= 5; i++) {
        const dot = document.createElement('div');
        dot.style.width = '12px';
        dot.style.height = '12px';
        dot.style.borderRadius = '50%';
        dot.style.backgroundColor = 'rgba(255, 255, 255, 0.5)';
        dot.style.cursor = 'pointer';
        dot.style.transition = 'all 0.3s ease';
        
        dot.addEventListener('mouseover', () => {
            if (i !== activeModelIndex) {
                dot.style.transform = 'scale(1.2)';
            }
        });
        
        dot.addEventListener('mouseout', () => {
            dot.style.transform = 'scale(1)';
        });
        
        dot.addEventListener('click', () => {
            if (!isTransitioning && i !== activeModelIndex) {
                const direction = i > activeModelIndex ? 'next' : 'prev';
                handleModelChange(direction);
            }
        });
        
        container.appendChild(dot);
    }

    document.getElementById('root').appendChild(container);
    return container;
};

const indicators = createModelIndicators();

// Enhanced scene setup
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputEncoding = THREE.sRGBEncoding;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;

// Add subtle fog
scene.fog = new THREE.Fog(0x000000, 5, 30);

// Ground reflection plane
const groundGeometry = new THREE.PlaneGeometry(100, 100);
const groundMaterial = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    metalness: 0.3,
    roughness: 0.4,
    transparent: true,
    opacity: 0.3
});
const ground = new THREE.Mesh(groundGeometry, groundMaterial);
ground.rotation.x = -Math.PI / 2;
ground.position.y = -2;
ground.receiveShadow = true;
scene.add(ground);

// Custom easing functions
const easing = {
    easeOutExpo: (x) => x === 1 ? 1 : 1 - Math.pow(2, -10 * x),
    easeInOutBack: (x) => {
        const c1 = 1.70158;
        const c2 = c1 * 1.525;
        return x < 0.5
            ? (Math.pow(2 * x, 2) * ((c2 + 1) * 2 * x - c2)) / 2
            : (Math.pow(2 * x - 2, 2) * ((c2 + 1) * (x * 2 - 2) + c2) + 2) / 2;
    },
    easeInOutCirc: (x) => x < 0.5
        ? (1 - Math.sqrt(1 - Math.pow(2 * x, 2))) / 2
        : (Math.sqrt(1 - Math.pow(-2 * x + 2, 2)) + 1) / 2
};

// Update models with simplified animations
function animate() {
    requestAnimationFrame(animate);
    
    // Update indicators
    const dots = indicators.children;
    for (let i = 0; i < dots.length; i++) {
        dots[i].style.backgroundColor = i + 1 === activeModelIndex ? 
            'rgba(255, 255, 255, 1)' : 'rgba(255, 255, 255, 0.5)';
        dots[i].style.transform = i + 1 === activeModelIndex ? 'scale(1.2)' : 'scale(1)';
    }
    
    // Handle transition animation
    if (isTransitioning) {
        transitionProgress += 0.016;
        if (transitionProgress >= 1) {
            isTransitioning = false;
            transitionProgress = 0;
        }
    }
    
    // Update models with minimal animations
    Object.entries(models).forEach(([key, model]) => {
        if (model) {
            const index = parseInt(key.replace('model', ''));
            
            // Calculate positions and transitions
            let targetX = index === activeModelIndex ? 0 : (index < activeModelIndex ? -8 : 8);
            let targetZ = (isLongPress && key === touchedModel) ? 2 : 0; // Increased forward movement
            
            if (isTransitioning) {
                const isActive = index === activeModelIndex;
                const isPrevious = index === previousModelIndex;
                
                if (isActive || isPrevious) {
                    const progress = easing.easeInOutCirc(transitionProgress);
                    
                    if (isPrevious) {
                        const exitDirection = index > activeModelIndex ? 8 : -8;
                        targetX = exitDirection * progress;
                    } else {
                        const entryDirection = index > previousModelIndex ? 8 : -8;
                        targetX = entryDirection * (1 - progress);
                    }
                }
            }
            
            // Apply position changes with smooth easing
            const positionSmoothing = isTransitioning ? 0.1 : 0.08;
            model.position.x += (targetX - model.position.x) * positionSmoothing;
            model.position.y = 0.5; // Keep models at raised position
            model.position.z += (targetZ - model.position.z) * positionSmoothing;
            
            // Only update material opacity during transitions
            if (isTransitioning) {
                model.traverse((child) => {
                    if (child.isMesh && child.material) {
                        if (!child.material.transparent) {
                            child.material = child.material.clone();
                            child.material.transparent = true;
                        }
                        const targetOpacity = (index === activeModelIndex) ? 1 : 0;
                        child.material.opacity += (targetOpacity - child.material.opacity) * 0.1;
                    }
                });
            }
        }
    });
    
    renderer.render(scene, camera);
}

animate(); 

// Initial instruction on page load for mobile
document.addEventListener('DOMContentLoaded', () => {
    if (window.innerWidth <= 768) {
        setTimeout(() => {
            showTouchInstruction('Swipe to change models');
        }, 1000);
    }
});

function handleTouchStart(event) {
    touchStartTime = Date.now();
    touchStartX = event.touches[0].clientX;
    touchStartY = event.touches[0].clientY;
    isDragging = false;
}

function handleTouchMove(event) {
    if (Date.now() - touchStartTime > 200) {
        isDragging = true;
        const deltaX = event.touches[0].clientX - touchStartX;
        if (!isZoomed) {
            models[activeModelIndex].rotation.y += deltaX * 0.005;
        }
    }
}

function handleTouchEnd() {
    const touchDuration = Date.now() - touchStartTime;
    
    if (!isDragging) {
        if (touchDuration > 200) {
            // Toggle zoom state
            isZoomed = !isZoomed;
            
            // Update camera position - minimal zoom
            const targetZ = isZoomed ? 3.5 : 4; // Very subtle zoom
            const duration = 500;
            const startZ = camera.position.z;
            const startTime = Date.now();

            // Update canvas z-index
            renderer.domElement.style.zIndex = isZoomed ? '9999' : '1';
            
            function animateCamera() {
                const currentTime = Date.now();
                const elapsed = currentTime - startTime;
                const progress = Math.min(elapsed / duration, 1);
                
                // Ease in-out function
                const easeProgress = progress < 0.5
                    ? 2 * progress * progress
                    : 1 - Math.pow(-2 * progress + 2, 2) / 2;
                
                camera.position.z = startZ + (targetZ - startZ) * easeProgress;
                
                // Animate model position and scale
                const currentModel = models[activeModelIndex];
                currentModel.position.y = normalPosition.y + (zoomedPosition.y - normalPosition.y) * easeProgress;
                
                const scaleValue = normalScale.x + (zoomedScale.x - normalScale.x) * easeProgress;
                currentModel.scale.set(scaleValue, scaleValue, scaleValue);
                
                if (progress < 1) {
                    requestAnimationFrame(animateCamera);
                }
            }
            
            animateCamera();
        } else {
            // Handle quick tap for model switching
            const touchX = touchStartX;
            if (touchX < window.innerWidth * 0.3) {
                handleModelChange('prev');
            } else if (touchX > window.innerWidth * 0.7) {
                handleModelChange('next');
            }
        }
    }
    
    isDragging = false;
} 