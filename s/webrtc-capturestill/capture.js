"use strict";

(function() {
  // The width and height of the captured photo. We will set the
  // width to the value defined here, but the height will be
  // calculated based on the aspect ratio of the input stream.

  var width = 320;    // We will scale the photo width to this
  var height = 0;     // This will be computed based on the input stream

  // |streaming| indicates whether or not we're currently streaming
  // video from the camera. Obviously, we start at false.

  var streaming = false;

  // stores the timeout id for the image processing function
  var processTimeout;

  // The various HTML elements we need to configure or control. These
  // will be set by the startup() function.

  var video = null;
  var inCanvas = null;
  var outCanvas = null;
  var photo = null;
  var startbutton = null;
  var onbutton = null;
  var offbutton = null;

  var prevImage = null;

  function startup() {
    video = document.getElementById('video');
    inCanvas = document.createElement("canvas");
    outCanvas = document.getElementById("canvas");
    photo = document.getElementById('photo');
    startbutton = document.getElementById('startbutton');
    onbutton = document.getElementById('switchon');
    offbutton = document.getElementById('switchoff');

    // Older browsers might not implement mediaDevices at all, so we set an empty object first
    if (navigator.mediaDevices === undefined) {
      navigator.mediaDevices = {};
    }

    // Some browsers partially implement mediaDevices. We can't just assign an object
    // with getUserMedia as it would overwrite existing properties.
    // Here, we will just add the getUserMedia property if it's missing.
    if (navigator.mediaDevices.getUserMedia === undefined) {
      navigator.mediaDevices.getUserMedia = function(constraints) {

        // First get ahold of the legacy getUserMedia, if present
        var getUserMedia = (navigator.getUserMedia ||
          navigator.webkitGetUserMedia ||
          navigator.mozGetUserMedia);

        // Some browsers just don't implement it - return a rejected promise with an error
        // to keep a consistent interface
        if (!getUserMedia) {
          return Promise.reject(new Error('getUserMedia is not implemented in this browser'));
        }

        // Otherwise, wrap the call to the old navigator.getUserMedia with a Promise
        return new Promise(function(resolve, reject) {
          getUserMedia.call(navigator, constraints, resolve, reject);
        });
      }
    }

    navigator.mediaDevices.getUserMedia(
      {
        video: true,
        audio: false
      })
    .then(function(stream) {
      video.srcObject = stream;
      // Older browsers may not have srcObject
      video.src = window.URL.createObjectURL(stream);
      video.play();
    })
    .catch(function(err) { console.log(err.name + ": " + err.message); }); // always check for errors at the end.

    video.addEventListener('canplay', function(ev){
      if (!streaming) {
        height = video.videoHeight / (video.videoWidth/width);

        // Firefox currently has a bug where the height can't be read from
        // the video, so we will make assumptions if this happens.

        if (isNaN(height)) {
          height = width / (4/3);
        }

        video.setAttribute('width', width);
        video.setAttribute('height', height);
        inCanvas.setAttribute('width', width);
        inCanvas.setAttribute('height', height);
        outCanvas.setAttribute('width', width);
        outCanvas.setAttribute('height', height);
        streaming = true;
      }
    }, false);

    startbutton.addEventListener('click', function(ev){
      takepicture();
      ev.preventDefault();
    }, false);

    onbutton.addEventListener('click', function(e){
      if (!processTimeout) {
        processTimeout = window.setTimeout(showContour, 0);
      }
    } );

    offbutton.addEventListener('click', function(e){
      if (processTimeout) {
        window.clearTimeout(processTimeout);
        processTimeout = undefined;
      }
    } );

    clearphoto();
  }

  // Fill the photo with an indication that none has been
  // captured.

  function clearphoto() {
    var context = inCanvas.getContext('2d');
    context.fillStyle = "#AAA";
    context.fillRect(0, 0, inCanvas.width, inCanvas.height);

    var data = inCanvas.toDataURL('image/png');
    photo.setAttribute('src', data);
  }

  // Capture a photo by fetching the current contents of the video
  // and drawing it into a canvas, then converting that to a PNG
  // format data URL. By drawing it on an offscreen canvas and then
  // drawing that to the screen, we can change its size and/or apply
  // other changes before drawing it.

  function takepicture() {
    var context = inCanvas.getContext('2d');
    if (width && height) {
      inCanvas.width = width;
      inCanvas.height = height;
      context.drawImage(video, 0, 0, width, height);

      var data = inCanvas.toDataURL('image/png');
      photo.setAttribute('src', data);
    } else {
      clearphoto();
    }
  }

  function showDiff() {
    var inContext = inCanvas.getContext('2d');
    var outContext = outCanvas.getContext('2d');
    if (width && height) {
      inCanvas.width = width;
      inCanvas.height = height;
      outCanvas.width = width;
      outCanvas.height = height;
      inContext.drawImage(video, 0, 0, width, height);
      var thisImage = inContext.getImageData(0, 0, width, height);

      if (prevImage) {
        var targetImage = outContext.createImageData(width, height);
        var index = 0;
        for (var y = 0; y < height; y++) {
          for (var x = 0; x < width; x++) {
            targetImage.data[index] = Math.abs(
              (thisImage.data[index]  + thisImage.data[index + 1] + thisImage.data[index + 2]) / 3 -
              (prevImage.data[index]  + prevImage.data[index + 1] + prevImage.data[index + 2]) / 3);
            targetImage.data[index + 1] = targetImage.data[index];
            targetImage.data[index + 2] = targetImage.data[index];
            targetImage.data[index + 3] = 255;
            index += 4;
          }
        }
        outContext.putImageData(targetImage, 0, 0);
      }

      prevImage = thisImage;
    } else {
      clearphoto();
    }
    processTimeout = window.setTimeout(showDiff, 40);
  }

  function showContour() {
    var inContext = inCanvas.getContext('2d');
    var outContext = outCanvas.getContext('2d');
    if (width && height) {
      inCanvas.width = width;
      inCanvas.height = height;
      outCanvas.width = width;
      outCanvas.height = height;
      inContext.drawImage(video, 0, 0, width, height);
      var thisImage = inContext.getImageData(0, 0, width, height);

      var targetImage = outContext.createImageData(width, height);
      var index = 0;
      for (var y = 0; y < height; y++) {
        for (var x = 0; x < width; x++) {
          targetImage.data[index] = Math.abs(
            (thisImage.data[index]  + thisImage.data[index + 1] + thisImage.data[index + 2]) / 3 -
            (thisImage.data[index + 4]  + thisImage.data[index + 5] + thisImage.data[index + 6]) / 3);
          targetImage.data[index + 1] = targetImage.data[index];
          targetImage.data[index + 2] = targetImage.data[index];
          targetImage.data[index + 3] = 255;
          index += 4;
        }
      }
      outContext.putImageData(targetImage, 0, 0);

    } else {
      clearphoto();
    }
    processTimeout = window.setTimeout(showContour, 40);
  }

  // Set up our event listener to run the startup process
  // once loading is complete.
  window.addEventListener('load', startup, false);
})();
