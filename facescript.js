// Access MediaPipe classes from the global window object loaded via CDN
const { FaceLandmarker, FilesetResolver } = vision;

let faceLandmarker;
let blinkCounter = 0;
let eyesClosed = false;

const video = document.getElementById("webcam");
const canvasElement = document.getElementById("output_canvas");
const canvasCtx = canvasElement.getContext("2d");
const blinkDisplay = document.getElementById("blink_display");
const statusText = document.getElementById("status");

// 1. Initialize the MediaPipe Face Landmarker
async function initializeFaceLandmarker() {
  try {
    // Fetch the WebAssembly (WASM) files needed to run the model efficiently
    const filesetResolver = await FilesetResolver.forVisionTasks(
      "https://jsdelivr.net"
    );
    
    faceLandmarker = await FaceLandmarker.createFromOptions(filesetResolver, {
      baseOptions: {
        modelAssetPath: `https://googleapis.com`,
        delegate: "GPU" // Uses your graphics card for ultra-fast performance
      },
      outputFaceBlendshapes: true, // Crucial: Enables eyeBlink coefficients
      runningMode: "VIDEO",
      numFaces: 1
    });
    
    statusText.innerText = "Model loaded! Starting webcam...";
    startWebcam();
  } catch (error) {
    statusText.innerText = "Error loading model. Check console.";
    console.error(error);
  }
}

// 2. Request webcam access and attach it to the HTML video element
function startWebcam() {
  navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 } })
    .then((stream) => {
      video.srcObject = stream;
      video.addEventListener("loadeddata", () => {
        statusText.innerText = "Tracking active. Blink your eyes!";
        predictWebcam();
      });
    })
    .catch((err) => {
      statusText.innerText = "Webcam access denied.";
      console.error(err);
    });
}

// 3. Main processing loop running at frame-rate speed
let lastVideoTime = -1;
async function predictWebcam() {
  // Synchronize canvas dimensions with the active video
  canvasElement.width = video.videoWidth;
  canvasElement.height = video.videoHeight;

  if (lastVideoTime !== video.currentTime) {
    lastVideoTime = video.currentTime;
    
    // Process the current video frame
    const startTimeMs = performance.now();
    const results = faceLandmarker.detectForVideo(video, startTimeMs);

    // Clear the drawing canvas every frame
    canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);

    // Check if blendshapes are detected
    if (results.faceBlendshapes && results.faceBlendshapes.length > 0) {
      const blendshapes = results.faceBlendshapes[0].categories;
      
      // Pull specific blink metrics (values range from 0.0 to 1.0)
      const blinkLeft = blendshapes.find(b => b.categoryName === "eyeBlinkLeft").score;
      const blinkRight = blendshapes.find(b => b.categoryName === "eyeBlinkRight").score;
      
      // Average both eyes to ensure it's a structural blink (not a wink)
      const currentBlinkScore = (blinkLeft + blinkRight) / 2.0;

      // Threshold Tuning: 0.70 means eyes are roughly 70% closed
      if (currentBlinkScore > 0.70) {
        if (!eyesClosed) {
          eyesClosed = true; // State change: eyes just closed
        }
      } else if (currentBlinkScore < 0.30) {
        if (eyesClosed) {
          // State change: eyes just opened after a valid closure
          blinkCounter++;
          blinkDisplay.innerText = `Blinks: ${blinkCounter}`;
          eyesClosed = false; 
        }
      }
    }
  }

  // Continuously request the next frame loop
  requestAnimationFrame(predictWebcam);
}

// Kickstart the application
initializeFaceLandmarker();