import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

// Scene setup
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setClearColor(0x000000, 0);
document.getElementById('root').appendChild(renderer.domElement);

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

// Camera position
camera.position.z = 4;

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

// Show touch instruction
const showTouchInstruction = (text) => {
    const instruction = document.querySelector('.touch-instruction');
    instruction.textContent = text;
    instruction.classList.add('visible');
    if (touchInstructionTimeout) clearTimeout(touchInstructionTimeout);
    touchInstructionTimeout = setTimeout(() => {
        instruction.classList.remove('visible');
    }, 2000);
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
        
        // Set up long press detection
        if (longPressTimeout) clearTimeout(longPressTimeout);
        if (touchedModel) {
            longPressTimeout = setTimeout(() => {
                handleLongPress(touch);
            }, 500); // 500ms for long press
            showTouchInstruction('Drag to rotate');
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
        if (touchedModel && !isRotating && !isLongPress) {
            isRotating = true;
            hoveredModel = touchedModel;
        }
    }
    
    // Handle rotation
    if (isRotating && touchedModel && !isLongPress) {
        const rotationDelta = (touch.clientX - lastTouchX) * 0.01;
        const model = models[touchedModel];
        if (model) {
            model.rotation.y += rotationDelta;
        }
        lastTouchX = touch.clientX;
        event.preventDefault();
    }
}, { passive: false });

renderer.domElement.addEventListener('touchend', (event) => {
    if (longPressTimeout) {
        clearTimeout(longPressTimeout);
    }
    
    if (!isSwiping) return;
    
    const touchDuration = Date.now() - touchStartTime;
    const deltaX = event.changedTouches[0].clientX - touchStartX;
    
    // Handle swipe only if we haven't started rotating or long pressing
    if (!isRotating && !isLongPress && Math.abs(deltaX) > 50) {
        if (deltaX > 0) {
            handleModelChange('prev');
        } else {
            handleModelChange('next');
        }
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

// Function to load a model
const loadModel = (index, file) => {
    console.log(`Loading model ${index}...`);
loader.load(
        `../models/${index}/${file}`,
    (gltf) => {
            console.log(`Model ${index} loaded successfully`);
            models[`model${index}`] = gltf.scene;
            models[`model${index}`].scale.set(2, 2, 2);
            models[`model${index}`].position.set(index === 1 ? 0 : 6, 0.2, 0);
            
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
            
            scene.add(models[`model${index}`]);
            updateLoadingProgress();
        },
        handleProgress(`model${index}.glb`),
    handleLoadError
);
};

// Load all models
loadModel(1, '1.glb');
loadModel(2, '2.glb');
loadModel(3, '3.glb');
loadModel(4, '4.glb');
loadModel(5, 'Untitled.glb');

// Raycaster for interaction
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

// Adjust camera and model scale based on screen size
const adjustForScreenSize = () => {
    const isMobile = window.innerWidth < 768;
    camera.position.z = isMobile ? 6 : 4;
    
    // Adjust model scale
    Object.values(models).forEach(model => {
        if (model) {
            const scale = isMobile ? 1.5 : 2;
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

// Enhanced animation loop
function animate() {
    requestAnimationFrame(animate);
    
    // Update indicators
    const dots = indicators.children;
    for (let i = 0; i < dots.length; i++) {
        dots[i].style.backgroundColor = i + 1 === activeModelIndex ? 
            'rgba(255, 255, 255, 1)' : 'rgba(255, 255, 255, 0.5)';
        
        if (i + 1 === activeModelIndex) {
            dots[i].style.transform = 'scale(1.2)';
        } else {
            dots[i].style.transform = 'scale(1)';
        }
    }
    
    // Handle transition animation
    if (isTransitioning) {
        transitionProgress += 0.016; // Slower transition
        if (transitionProgress >= 1) {
            isTransitioning = false;
            transitionProgress = 0;
        }
    }
    
    // Update ground reflection
    if (ground) {
        ground.position.x = camera.position.x;
        ground.position.z = camera.position.z;
        ground.material.opacity = 0.3 + Math.sin(Date.now() * 0.001) * 0.1;
    }
    
    // Animate point light
    if (pointLight) {
        const time = Date.now() * 0.001;
        pointLight.position.x = Math.sin(time * 0.5) * 3;
        pointLight.position.z = Math.cos(time * 0.5) * 3;
    }
    
    // Update models with enhanced animations
    Object.entries(models).forEach(([key, model]) => {
        if (model && !isDragging) {
            const index = parseInt(key.replace('model', ''));
            
            // Calculate base floating position
            const time = Date.now() * 0.001;
            const floatingY = 0.2 + Math.sin(time + index) * 0.1;
            
            // Calculate positions and transitions
            let targetX = index === activeModelIndex ? 0 : (index < activeModelIndex ? -8 : 8);
            let targetY = floatingY;
            let targetZ = 0;
            let targetOpacity = 1;
            let targetSpotlightIntensity = 0;
            
            // Handle hover/long press state
            if ((hoveredModel === key && !isTransitioning) || (isLongPress && hoveredModel === key)) {
                targetZ = 1.5;
                targetSpotlightIntensity = 2;
            }
            
            if (isTransitioning) {
                const isActive = index === activeModelIndex;
                const isPrevious = index === previousModelIndex;
                
                if (isActive || isPrevious) {
                    // Use custom easing for smoother transitions
                    const progress = easing.easeInOutCirc(transitionProgress);
                    
                    if (isPrevious) {
                        // Previous model animation (sliding out)
                        const slideProgress = easing.easeInOutQuint(progress);
                        // Determine exit direction based on which way we're moving
                        const exitDirection = index > activeModelIndex ? 8 : -8;
                        targetX = exitDirection * slideProgress;
                        
                        // Fade out with slight delay at start
                        const fadeProgress = Math.max(0, (progress - 0.1) / 0.9);
                        targetOpacity = 1 - easing.easeInOutQuint(fadeProgress);
                    } else {
                        // New model animation (sliding in)
                        const slideProgress = easing.easeOutQuint(progress);
                        // Determine entry direction (opposite of exit direction)
                        const entryDirection = index > previousModelIndex ? 8 : -8;
                        targetX = entryDirection * (1 - slideProgress);
                        
                        // Fade in
                        targetOpacity = easing.easeOutQuint(progress);
                    }
                    
                    // Reset Z position during transition
                    targetZ = 0;
                }
            }
            
            // Apply position changes with smooth easing
            const positionSmoothing = isTransitioning ? 0.1 : 0.08;
            model.position.x += (targetX - model.position.x) * positionSmoothing;
            model.position.y += (targetY - model.position.y) * 0.05;
            model.position.z += (targetZ - model.position.z) * positionSmoothing;
            
            // Update spotlight
            const spotlight = spotlights[key];
            if (spotlight) {
                // Update spotlight position to follow model
                spotlight.position.x = model.position.x;
                spotlight.position.y = model.position.y + 5;
                spotlight.position.z = model.position.z - 5;
                
                // Point spotlight at model
                spotlight.target = model;
                
                // Smooth intensity transition
                spotlight.intensity += (targetSpotlightIntensity - spotlight.intensity) * 0.1;
            }
            
            // Keep models facing forward
            model.rotation.set(0, 0, 0);
            
            // Apply scale changes with hover effect
            const targetScale = hoveredModel === key ? 2.2 : 2;
            model.scale.lerp(new THREE.Vector3(targetScale, targetScale, targetScale), 0.08);
            
            // Apply material changes
            model.traverse((child) => {
                if (child.isMesh && child.material) {
                    if (!child.material.transparent) {
                        child.material = child.material.clone();
                        child.material.transparent = true;
                    }
                    const opacitySmoothing = isTransitioning ? 0.15 : 0.1;
                    child.material.opacity += (targetOpacity - child.material.opacity) * opacitySmoothing;
                    
                    // Enhanced shine effect
                    child.material.envMapIntensity = 1.2 + Math.sin(time + index) * 0.2;
                    
                    // Add extra shine when hovered
                    if (hoveredModel === key) {
                        child.material.envMapIntensity += 0.5;
                    }
                }
            });
        }
    });
    
    // Add quintic easing function for smoother motion
    easing.easeInOutQuint = (x) => {
        return x < 0.5 ? 16 * x * x * x * x * x : 1 - Math.pow(-2 * x + 2, 5) / 2;
    };

    easing.easeOutQuint = (x) => {
        return 1 - Math.pow(1 - x, 5);
    };
    
    renderer.render(scene, camera);
}

animate(); 