/* eslint-disable */
const video = document.getElementById("video");

Promise.all([
  faceapi.nets.tinyFaceDetector.loadFromUri("/models"),
  faceapi.nets.faceLandmark68Net.loadFromUri("/models"),
  faceapi.nets.faceRecognitionNet.loadFromUri("/models"),
  // faceapi.nets.faceExpressionNet.loadFromUri("/models")
]).then(startVideo);

function startVideo() {
  navigator.getUserMedia(
    { video: {} },
    stream => (video.srcObject = stream),
    err => console.error(err)
  );
}

video.addEventListener("play", () => {
  const canvas = faceapi.createCanvasFromMedia(video);
  document.body.append(canvas);
  const displaySize = { width: video.width, height: video.height };
  faceapi.matchDimensions(canvas, displaySize);
  setInterval(async () => {
    const detections = await faceapi
      .detectAllFaces(video, new faceapi.TinyFaceDetectorOptions())
      .withFaceLandmarks();
    // .withFaceExpressions();
    if (detections.length > 0) {
      if (detections.length === 1) {
        console.log(`Person(s): ${detections.length}`);
        const personOne = detections[0].landmarks;
        let leftEye = personOne.getLeftEye();
        let rightEye = personOne.getRightEye();
        let mouth = personOne.getMouth();
        let nose = personOne.getNose();
        let jawLine = personOne.getJawOutline();

        // ###############  OUTPUT ####################
        const alignment = calculateAlignment(leftEye, rightEye, nose, jawLine);
        console.log("Face alignment: ", alignment);
        const tilt = calculateTilt(leftEye, rightEye);
        console.log("Tilt(2D): ", tilt);
        const mouthSeparation = calculateMouthSeparation(mouth);
        console.log("Mouth: ", mouthSeparation);
        console.warn("######################");
        const resizedDetections = faceapi.resizeResults(
          detections,
          displaySize
        );
        canvas.getContext("2d").clearRect(0, 0, canvas.width, canvas.height);
        faceapi.draw.drawDetections(canvas, resizedDetections);
        faceapi.draw.drawFaceLandmarks(canvas, resizedDetections);
        // faceapi.draw.drawFaceExpressions(canvas, resizedDetections);
      } else {
        const resizedDetections = faceapi.resizeResults(
          detections,
          displaySize
        );
        canvas.getContext("2d").clearRect(0, 0, canvas.width, canvas.height);
        faceapi.draw.drawDetections(canvas, resizedDetections);
        faceapi.draw.drawFaceLandmarks(canvas, resizedDetections);
        console.error(
          `Multiple people detected - ${detections.length}. Calculations are disabled.`
        );
      }
    } else {
      console.error(
        "No person detected... Try adjusting light and orientation"
      );
    }
  }, 250);
});

/**
 * Gap in inner circle tells if mouth is open or not.
 * Point description - 20 points in total.
 * 0-11 > Outer circle. Clockwise - starting from left tip of mouth
 * 12-19 > Inner circle. Clockwise - starting from left tip of lips.
 * @param mouth mouth points from lib
 */
function calculateMouthSeparation(mouth) {
  const topLipCenter = mouth[14];
  const bottomLipCenter = mouth[18];
  const separation = bottomLipCenter.y - topLipCenter.y;
  if (separation > 80) {
    console.error("Yawning or Screaming for life");
  }
  return separation < 5 ? "Closed" : separation < 15 ? "Slightly open" : "Open";
}

/**
 * Calculate using distance between eye and chin points from jawline.
 * TODO: Add a multiplier based on distance to change thresholds for
 * other calculations.
 */
function calculateDistance() {}

/**
 * Calculate neck tilt by measuring horizontal eye alignment.
 * Can be improved by adding nose slope into consideration.
 * Points description - 6 points in total
 * 2 top, 2 bottom, 2 tips. Clockwise from left tip of eye.
 * @param leftEye leftEye points from lib
 * @param rightEye rightEye points from lib
 */
function calculateTilt(leftEye, rightEye) {
  const leftEyeLeftMostPoint = leftEye[0];
  const rightEyeRightMostPoint = rightEye[4];
  const heightDiff = leftEyeLeftMostPoint.y - rightEyeRightMostPoint.y;
  const prob = Math.abs(heightDiff) <= 10 ? "Slightly" : "To";
  const dir = heightDiff > 0 ? "right" : "left";
  return `${prob} ${dir}`;
}

function calculateAlignment(leftEye, rightEye, nose, jawLine) {
  const vert = calculateVerticalAlignment(leftEye, rightEye, nose, jawLine);
  const horz = calculateHorizontalAlignment(leftEye, rightEye, nose);
  if (vert === "Straight" && horz === "Straight") {
    return "Straight";
  } else if (vert === "Straight") {
    return horz;
  } else if (horz === "Straight") {
    return vert;
  } else {
    return `${vert}-${horz}`;
  }
}

function calculateVerticalAlignment(leftEye, rightEye, nose, jawLine) {
  calculateHorizontalAlignment(leftEye, rightEye, nose, jawLine);
  const leftEyeRightMostPoint = leftEye[4];
  const rightEyeLeftMostPoint = rightEye[0];
  const leftEyeTopPoint = leftEye[3];
  const rightEyeTopPoint = rightEye[3];
  const noseTopPoint = nose[0];
  const jawLeft = jawLine[0];
  const jawRight = jawLine[0];

  if (
    noseTopPoint.y < leftEyeRightMostPoint.y &&
    noseTopPoint.y < rightEyeLeftMostPoint.y &&
    jawLeft.y > leftEyeRightMostPoint.y &&
    jawRight.y > rightEyeLeftMostPoint.y
  ) {
    return "Up";
  } else if (
    noseTopPoint.y > leftEyeTopPoint.y &&
    noseTopPoint.y > rightEyeTopPoint.y &&
    jawLeft.y < leftEyeRightMostPoint.y &&
    jawRight.y < rightEyeLeftMostPoint.y
  ) {
    return "Down";
  } else {
    return "Straight";
  }
}

function calculateHorizontalAlignment(leftEye, rightEye, nose) {
  const leftEyeRightMostPoint = leftEye[4];
  const rightEyeLeftMostPoint = rightEye[0];
  const eyeGap = rightEyeLeftMostPoint.x - leftEyeRightMostPoint.x;
  const noseTopPoint = nose[0];
  const leftEyeAndNoseGapPercentage =
    ((noseTopPoint.x - leftEyeRightMostPoint.x) * 100) / eyeGap;
  const RightEyeAndNoseGapPercentage =
    ((noseTopPoint.x - rightEyeLeftMostPoint.x) * 100) / eyeGap;
  const percentageDelta =
    Math.abs(leftEyeAndNoseGapPercentage) -
    Math.abs(RightEyeAndNoseGapPercentage);
  return Math.abs(percentageDelta) < 10
    ? "Straight"
    : percentageDelta > 0
    ? "Left"
    : "Right";
}
