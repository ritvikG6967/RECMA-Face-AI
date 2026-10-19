import { FaceLandmarker, FilesetResolver } from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest";

let faceLandmarker;
let blinkCounter = 0;
let eyesClosed = false;
let lastVideoTime = -1;

const video = document.getElementById("webcam");
const canvasElement = document.getElementById("output_canvas");
const canvasCtx = canvasElement.getContext("2d");
const blinkDisplay = document.getElementById("blink_display");
const statusText = document.getElementById("status");

async function initializeFaceLandmarker() {
  statusText.innerText = "Loading face model…";

  try {
    const filesetResolver = await FilesetResolver.forVisionTasks(
      "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
    );
    const modelOptions = {
      modelAssetPath: "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task",
      delegate: "GPU"
    };

    try {
      faceLandmarker = await FaceLandmarker.createFromOptions(filesetResolver, {
        baseOptions: modelOptions,
        outputFaceBlendshapes: true,
        runningMode: "VIDEO",
        numFaces: 1
      });
    } catch (gpuError) {
      console.warn("GPU delegate unavailable; retrying with CPU.", gpuError);
      faceLandmarker = await FaceLandmarker.createFromOptions(filesetResolver, {
        baseOptions: { ...modelOptions, delegate: "CPU" },
        outputFaceBlendshapes: true,
        runningMode: "VIDEO",
        numFaces: 1
      });
    }

    await startWebcam();
  } catch (error) {
    statusText.innerText = `Could not start face tracking: ${error.message}`;
    console.error("MediaPipe initialization failed:", error);
  }
}

async function startWebcam() {
  if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
    statusText.innerText = "Webcam requires HTTPS or localhost. Open this page through a local development server.";
    return;
  }

  statusText.innerText = "Requesting webcam access…";

  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } }
    });
    video.srcObject = stream;
    await video.play();

    canvasElement.width = video.videoWidth;
    canvasElement.height = video.videoHeight;
    statusText.innerText = "Tracking active. Blink your eyes!";
    requestAnimationFrame(predictWebcam);
  } catch (error) {
    const message = error.name === "NotAllowedError"
      ? "Webcam permission was denied. Allow camera access in your browser settings and reload."
      : error.name === "NotFoundError"
        ? "No webcam was found. Connect or enable a camera and reload."
        : `Could not open webcam: ${error.message}`;
    statusText.innerText = message;
    console.error("Webcam error:", error);
  }
}

function predictWebcam() {
  if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA && video.currentTime !== lastVideoTime) {
    lastVideoTime = video.currentTime;
    canvasElement.width = video.videoWidth;
    canvasElement.height = video.videoHeight;

    try {
      const results = faceLandmarker.detectForVideo(video, performance.now());
      canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);

      const categories = results.faceBlendshapes?.[0]?.categories;
      if (categories) {
        const blinkLeft = categories.find(item => item.categoryName === "eyeBlinkLeft")?.score ?? 0;
        const blinkRight = categories.find(item => item.categoryName === "eyeBlinkRight")?.score ?? 0;
        const currentBlinkScore = (blinkLeft + blinkRight) / 2;

        if (currentBlinkScore > 0.7) {
          eyesClosed = true;
        } else if (currentBlinkScore < 0.3 && eyesClosed) {
          blinkCounter++;
          blinkDisplay.innerText = `Blinks: ${blinkCounter}`;
          eyesClosed = false;
        }
      }
    } catch (error) {
      statusText.innerText = "Face tracking stopped. See the browser console for details.";
      console.error("Face detection failed:", error);
      return;
    }
  }

  requestAnimationFrame(predictWebcam);
}

initializeFaceLandmarker();