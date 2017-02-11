
var gl;
var canvas;

var shaderProgram;

// Create a place to store the texture coords for the skybox
var cubeTCoordBuffer;

// Create a place to store skybox geometry
var cubeVertexBuffer;

// Create a place to store the triangles
var cubeTriIndexBuffer;

// Create a place to store the texture coords for the teapot
var tVertexPositionBuffer;

// Create a place to store the normal vectors for the teapot vertex
var tVertexNormalBuffer;

// Create a place to store the coords for the skybox
var tIndexTriBuffer;


// global flag to show indicate which skybox we are using 
var london = false ;
var golden = true ;
var saint = false ;

// Create ModelView matrix
var mvMatrix = mat4.create();
var rMatrix = mat4.create();


//var mvMatrix = mat4.create();

var Inverse_mvMatrix = mat4.create();

// Create Projection matrix
var pMatrix = mat4.create();

// Create Normal matrix
var nMatrix = mat3.create();

var mvMatrixStack = [];

// Create a place to store the texture
var cubeImage;
var cubeTexture;

// View parameters
var eyePt = vec3.fromValues(0.0,0.0,10.0);
var viewDir = vec3.fromValues(0.0,0.0,-1.0);
var up = vec3.fromValues(0.0,1.0,0.0);
var viewPt = vec3.fromValues(0.0,0.0,0.0);

var then =0;
var modelYRotationRadiansA = degToRad(0);
var modelYRotationRadiansB = degToRad(0);

//-------------------------------------------------------------------------
function uploadModelViewMatrixToShader() {
	gl.uniformMatrix4fv(shaderProgram.mvMatrixUniform, false, mvMatrix);
}

//-------------------------------------------------------------------------
function uploadProjectionMatrixToShader() {
	gl.uniformMatrix4fv(shaderProgram.pMatrixUniform, false, pMatrix);
}

//-------------------------------------------------------------------------
function uploadNormalMatrixToShader() {
    mat3.fromMat4(nMatrix,mvMatrix);
    mat3.transpose(nMatrix,nMatrix);
    mat3.invert(nMatrix,nMatrix);
    gl.uniformMatrix3fv(shaderProgram.nMatrixUniform, false, nMatrix);
}

//----------------------------------------------------------------------------------
function mvPushMatrix() {
    var copy = mat4.clone(mvMatrix);
    mvMatrixStack.push(copy);
}


//----------------------------------------------------------------------------------
function mvPopMatrix() {
    if (mvMatrixStack.length == 0) {
    	throw "Invalid popMatrix!";
    }
    mvMatrix = mvMatrixStack.pop();
}

//----------------------------------------------------------------------------------
function setMatrixUniforms() {
    uploadModelViewMatrixToShader();
	uploadNormalMatrixToShader();
    uploadProjectionMatrixToShader();
    //mat4.invert(Inverse_mvMatrix,mvMatrix);
    //gl.uniformMatrix4fv(shaderProgram.In_mvMatrixUniform, false, Inverse_mvMatrix ) ;
    //gl.uniformMatrix4fv(shaderProgram.rMatrixUniform, false, rMatrix ) ;
}

//----------------------------------------------------------------------------------
function degToRad(degrees) {
	return degrees * Math.PI / 180;
}

//----------------------------------------------------------------------------------
function createGLContext(canvas) {
	var names = ["webgl", "experimental-webgl"];
	var context = null;
	for (var i=0; i < names.length; i++) {
		try {
		  context = canvas.getContext(names[i]);
		} catch(e) {}
		if (context) {
		  break;
		}
	}
	if (context) {
		context.viewportWidth = canvas.width;
		context.viewportHeight = canvas.height;
	} else {
		alert("Failed to create WebGL context!");
	}
	return context;
}

/**
 * load shaders from html document
 * @param None
 * @return None
 */
function loadShaderFromDOM(id) {
	var shaderScript = document.getElementById(id);

	// If we don't find an element with the specified id
	// we do an early exit 
	if (!shaderScript) {
		return null;
	}

	// Loop through the children for the found DOM element and
	// build up the shader source code as a string
	var shaderSource = "";
	var currentChild = shaderScript.firstChild;
	while (currentChild) {
		if (currentChild.nodeType == 3) { // 3 corresponds to TEXT_NODE
			shaderSource += currentChild.textContent;
		}
		currentChild = currentChild.nextSibling;
	}

	var shader;
	if (shaderScript.type == "x-shader/x-fragment") {
		shader = gl.createShader(gl.FRAGMENT_SHADER);
	} else if (shaderScript.type == "x-shader/x-vertex") {
		shader = gl.createShader(gl.VERTEX_SHADER);
	} else {
		return null;
	}

	gl.shaderSource(shader, shaderSource);
	gl.compileShader(shader);

	if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
		alert(gl.getShaderInfoLog(shader));
		return null;
	} 
	return shader;
}

/**
 * set up the shaders, grad all the variables we gonna use
 * @param None
 * @return None
 */
function setupShaders() {
	vertexShader = loadShaderFromDOM("shader-vs");
	fragmentShader = loadShaderFromDOM("shader-fs");

	shaderProgram = gl.createProgram();
	gl.attachShader(shaderProgram, vertexShader);
	gl.attachShader(shaderProgram, fragmentShader);
	gl.linkProgram(shaderProgram);

	if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) {
		alert("Failed to setup shaders");
	}

	gl.useProgram(shaderProgram);

	shaderProgram.vertexPositionAttribute = gl.getAttribLocation(shaderProgram, "aVertexPosition");
	gl.enableVertexAttribArray(shaderProgram.vertexPositionAttribute);
	
    shaderProgram.vertexNormalAttribute = gl.getAttribLocation(shaderProgram, "aVertexNormal");
    gl.enableVertexAttribArray(shaderProgram.vertexNormalAttribute);

	shaderProgram.mvMatrixUniform = gl.getUniformLocation(shaderProgram, "uMVMatrix");
    shaderProgram.In_mvMatrixUniform = gl.getUniformLocation(shaderProgram, "In_uMVMatrix");
    shaderProgram.rMatrixUniform = gl.getUniformLocation(shaderProgram, "rMatrix");
	shaderProgram.pMatrixUniform = gl.getUniformLocation(shaderProgram, "uPMatrix");
	shaderProgram.nMatrixUniform = gl.getUniformLocation(shaderProgram, "uNMatrix");
    shaderProgram.uniformLightPositionLoc = gl.getUniformLocation(shaderProgram, "uLightPosition");    
	shaderProgram.uniformAmbientLightColorLoc = gl.getUniformLocation(shaderProgram, "uAmbientLightColor");  
	shaderProgram.uniformDiffuseLightColorLoc = gl.getUniformLocation(shaderProgram, "uDiffuseLightColor");
	shaderProgram.uniformSpecularLightColorLoc = gl.getUniformLocation(shaderProgram, "uSpecularLightColor");
}

/**
 * set up the skybox, first set a giant cube, then map texture to it 
 * @param None
 * @return None
 */
function setupSkybox() {

  // Create a buffer for the cube's vertices.
  cubeVertexBuffer = gl.createBuffer();
        
  // Select the cubeVerticesBuffer as the one to apply vertex
  // operations to from here out.
  gl.bindBuffer(gl.ARRAY_BUFFER, cubeVertexBuffer);

  // Now create an array of vertices for the cube.
  var vertices = [
    // Front face
    -120.0, -120.0,  120.0,
     120.0, -120.0,  120.0,
     120.0,  120.0,  120.0,
    -120.0,  120.0,  120.0,

    // Back face
    -120.0, -120.0, -120.0,
    -120.0,  120.0, -120.0,
     120.0,  120.0, -120.0,
     120.0, -120.0, -120.0,

    // Top face
    -120.0,  120.0, -120.0,
    -120.0,  120.0,  120.0,
     120.0,  120.0,  120.0,
     120.0,  120.0, -120.0,

    // Bottom face
    -120.0, -120.0, -120.0,
     120.0, -120.0, -120.0,
     120.0, -120.0,  120.0,
    -120.0, -120.0,  120.0,

    // Right face
     120.0, -120.0, -120.0,
     120.0,  120.0, -120.0,
     120.0,  120.0,  120.0,
     120.0, -120.0,  120.0,

    // Left face
    -120.0, -120.0, -120.0,
    -120.0, -120.0,  120.0,
    -120.0,  120.0,  120.0,
    -120.0,  120.0, -120.0
  ];

  // Now pass the list of vertices into WebGL to build the shape. We
  // do this by creating a Float32Array from the JavaScript array,
  // then use it to fill the current vertex buffer.
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW);

  // Build the element array buffer; this specifies the indices
  // into the vertex array for each face's vertices.
  cubeTriIndexBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, cubeTriIndexBuffer);

  // This array defines each face as two triangles, using the
  // indices into the vertex array to specify each triangle's
  // position.
  var cubeVertexIndices = [ 
    0,  1,  2,      0,  2,  3,    // front
    4,  5,  6,      4,  6,  7,    // back
    8,  9,  10,     8,  10, 11,   // top
    12, 13, 14,     12, 14, 15,   // bottom
    16, 17, 18,     16, 18, 19,   // right
    20, 21, 22,     20, 22, 23    // left
  ]

  // Now send the element array to GL
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,
      new Uint16Array(cubeVertexIndices), gl.STATIC_DRAW);

     // Initialize the Cube Map, and set its parameters
    cubeTexture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_CUBE_MAP, cubeTexture); 
    gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MAG_FILTER, 
          gl.LINEAR); 
    gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MIN_FILTER,    
          gl.LINEAR);

    // Load up each cube map face
    loadCubeMapFace(gl, gl.TEXTURE_CUBE_MAP_POSITIVE_X, 
          cubeTexture, 'textures/posx.jpg');  
    loadCubeMapFace(gl, gl.TEXTURE_CUBE_MAP_NEGATIVE_X,    
         cubeTexture, 'textures/neg-x.jpg');    
    loadCubeMapFace(gl, gl.TEXTURE_CUBE_MAP_POSITIVE_Y, 
        cubeTexture, 'textures/posy.jpg');  
    loadCubeMapFace(gl, gl.TEXTURE_CUBE_MAP_NEGATIVE_Y, 
       cubeTexture, 'textures/neg-y.jpg');  
    loadCubeMapFace(gl, gl.TEXTURE_CUBE_MAP_POSITIVE_Z, 
       cubeTexture, 'textures/posz.jpg');  
    loadCubeMapFace(gl, gl.TEXTURE_CUBE_MAP_NEGATIVE_Z, 
       cubeTexture, 'textures/neg-z.jpg'); 
}

/**
 * load the image for a cube face
 * @param None
 * @return None
 */
function loadCubeMapFace(gl, target, texture, url){
    var image = new Image();
    image.onload = function()
    {
    	gl.bindTexture(gl.TEXTURE_CUBE_MAP, cubeTexture);
        gl.texImage2D(target, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
    }
    image.src = url;
}

/**
 * read the teapot file
 * @param None
 * @return None
 */
function loadTeapot(){
    $.get( "teapot_0.obj", function( data ) {
       setupTeapotBuffers(data) ;
    });
} 


/**
 * setup the buffer used by draw teapot 
 * @param text read from .obj file
 * @return None
 */
function setupTeapotBuffers(file){
    
    vertexNum = 0;
	faceNum = 0;
    var vertices = [];
	var faces = [];
	
	var lines = file.split("\r\n");
    for (var i=0 ; i < lines.length; i++ ){
		
        line = lines[i].split(' ');
		
		if (line[0] == 'v'){
			vertices.push(parseFloat(line[1]));
			vertices.push(parseFloat(line[2]));
			vertices.push(parseFloat(line[3]));
			vertexNum += 1;
		}
		else if(line[0] == 'f'){
			faces.push(parseInt(line[2])-1);
			faces.push(parseInt(line[3])-1);
			faces.push(parseInt(line[4])-1);
			faceNum += 1;
		}
	}
	 
    // Specify the positions of vertices 
	tVertexPositionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, tVertexPositionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW);
	tVertexPositionBuffer.numItems = vertexNum;
	  
    tVertexNormalBuffer = gl.createBuffer();
	gl.bindBuffer(gl.ARRAY_BUFFER, tVertexNormalBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(ComputeNormals(vertices, faces, faceNum, vertexNum )), gl.STATIC_DRAW);
    tVertexNormalBuffer.itemSize = 3;
    tVertexNormalBuffer.numItems = faceNum;
	
    tIndexTriBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, tIndexTriBuffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(faces), gl.STATIC_DRAW);
	tIndexTriBuffer.numItems = faceNum;
	
}

/**
 * compute noraml vectors for each vertice
 * @param None
 * @return None
 */
function ComputeNormals(vertices, faces, numF, numV ){
    
    var faceNormals = [];
    var normals = Array(vertexNum * 3).fill(0);
    var count = Array(numV).fill(0);
    
    // calculate normals for face
    for (var i = 0; i < numF; i++){
    
        var v1 = faces[i*3];
        var v2 = faces[i*3 + 1];
        var v3 = faces[i*3 + 2];
        
        count[v1] += 1
        count[v2] += 1
        count[v3] += 1
          
        // x,y,z v1  -> vector 1
        var vector1 = vec3.fromValues(vertices[3*v2]-vertices[3*v1], vertices[3*v2+1]-vertices[3*v1+1], vertices[3*v2+2]-vertices[3*v1+2]);
        // x,y,z v2 -> vector 2
        var vector2 = vec3.fromValues(vertices[3*v3]-vertices[3*v1], vertices[3*v3+1]-vertices[3*v1+1], vertices[3*v3+2]-vertices[3*v1+2]);
        
        vec3.cross(vector1, vector1, vector2);
		
        // vertex 0
        normals[3*v1 + 0] += vector1[0];
        normals[3*v1 + 1] += vector1[1];
        normals[3*v1 + 2] += vector1[2];
        
        // vertex 1
        normals[3*v2 + 0] += vector1[0];
        normals[3*v2 + 1] += vector1[1];
        normals[3*v2 + 2] += vector1[2];
        
        // vertex 2
        normals[3*v3 + 0] += vector1[0];
        normals[3*v3 + 1] += vector1[1];
        normals[3*v3 + 2] += vector1[2];
    
    }
	    
    // average the noraml vectors
    for (var i = 0; i < numV; i++){
    
        x = normals[3*i+0]/count[i];
        y = normals[3*i+1]/count[i];
        z = normals[3*i+2]/count[i];
        
        var normal = vec3.fromValues(x, y, z );
        vec3.normalize(normal, normal);
        
        // store the normal vector
        normals[i*3+0] = normal[0];
        normals[i*3+1] = normal[1];
        normals[i*3+2] = normal[2];
        
    }

    return normals 

}


/**
 * draw the the entire program
 * @param None
 * @return None
 */
function draw() { 
    var translateVec = vec3.create();
    var scaleVec = vec3.create();
  
    gl.viewport(0, 0, gl.viewportWidth, gl.viewportHeight);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    // We'll use perspective 
    mat4.perspective(pMatrix,degToRad(70), gl.viewportWidth / gl.viewportHeight, 1, 2000.0);
 
    //Draw            
    mvPushMatrix();
    vec3.set(translateVec,0.0,0.0,-10.0);
    mat4.translate(mvMatrix, mvMatrix,translateVec);
    mat4.translate(rMatrix, rMatrix,translateVec);
    
    // roate the entire world
    mat4.rotateY(mvMatrix,mvMatrix,modelYRotationRadiansB) ;
    drawSkybox();
    
    // compute the inverted mvMartirx used by the mirror texture
    mat4.invert(Inverse_mvMatrix,mvMatrix);
    gl.uniformMatrix4fv(shaderProgram.In_mvMatrixUniform, false, Inverse_mvMatrix ) ;
        
    // rotate the teapot only 
    mat4.rotateY(mvMatrix,mvMatrix,modelYRotationRadiansA) ;   
    drawTeapot();
    
    // set up the camera
    vec3.add(viewPt, eyePt, viewDir);
    mat4.lookAt(mvMatrix,eyePt,viewPt,up);
    setMatrixUniforms();
    
    // light setting 
    gl.uniform3fv(shaderProgram.uniformAmbientLightColorLoc, [0.8,0.8,0.0]);
    gl.uniform3fv(shaderProgram.uniformDiffuseLightColorLoc, [0.8,0.8,0.0]);
    gl.uniform3fv(shaderProgram.uniformSpecularLightColorLoc, [0.8,0.8,0]);
    gl.uniform3fv(shaderProgram.uniformLightPositionLoc, [0,30,0]);

    mvPopMatrix();
  
}


/**
 * draw the skybox with the buffer data
 * @param None
 * @return None
 */
function drawSkybox(){
    // tell the shader that we are drawing the skybox
    gl.uniform1f(gl.getUniformLocation(shaderProgram, "Skybox"), true);
	
	// Draw the cube by binding the array buffer to the cube's vertices
	// array, setting attributes, and pushing it to GL.
	gl.bindBuffer(gl.ARRAY_BUFFER, cubeVertexBuffer);
	gl.vertexAttribPointer(shaderProgram.vertexPositionAttribute, 3, gl.FLOAT, false, 0, 0);
	
	// Draw the cube by binding the array buffer to the cube's vertices
	// array, setting attributes, and pushing it to GL.
	gl.bindBuffer(gl.ARRAY_BUFFER, cubeVertexBuffer);
	gl.vertexAttribPointer(shaderProgram.vertexNormalAttribute, 3, gl.FLOAT, false, 0, 0);

	// Specify the texture to map onto the faces.
	gl.activeTexture(gl.TEXTURE0);
	gl.bindTexture(gl.TEXTURE_CUBE_MAP, cubeTexture);
	gl.uniform1i(gl.getUniformLocation(shaderProgram, "uSampler"), 0);

	// Draw the cube.
	gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, cubeTriIndexBuffer);
	setMatrixUniforms();
	gl.drawElements(gl.TRIANGLES, 36, gl.UNSIGNED_SHORT, 0);
}


/**
 * draw teapot with the buffer data
 * @param None
 * @return None
 */
function drawTeapot(){
	// tell the shader that we are drawing teapot instead of skybox
    gl.uniform1f(gl.getUniformLocation(shaderProgram, "Skybox"), false);

        
	gl.bindBuffer(gl.ARRAY_BUFFER, tVertexPositionBuffer);
	gl.vertexAttribPointer(shaderProgram.vertexPositionAttribute, 3, gl.FLOAT, false, 0, 0);
		
    
	gl.bindBuffer(gl.ARRAY_BUFFER, tVertexNormalBuffer);
	gl.vertexAttribPointer(shaderProgram.vertexNormalAttribute, 3, gl.FLOAT, false, 0, 0);  

    // Draw the teapot
	gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, tIndexTriBuffer);
	setMatrixUniforms();
	gl.drawElements(gl.TRIANGLES, 6768, gl.UNSIGNED_SHORT, 0);
}


/**
 * Handle user keyboard input
 * @param None
 * @return None
 */
function handleKeyboardInput() {
    
    document.onkeydown = function(e) {
    switch (e.keyCode) {
        //left
        case 37:
            modelYRotationRadiansA -= 0.2 ;
            e.preventDefault(); 
            break;               
        //up
        case 38:         
           break;
        //right
        case 39:
            modelYRotationRadiansA += 0.2 ;
            e.preventDefault(); 
            break;
        //down    
        case 40:
            break;
        //w        
        case 87:  
            break;
        //s    
        case 83:
            break;     
        //a
        case 65:
            modelYRotationRadiansB -= 0.2 ;
            e.preventDefault(); 
            break; 
        //d
        case 68:   
            modelYRotationRadiansB += 0.2 ;
            e.preventDefault(); 
            break; 
     }
    }
        

   // change background to london
    $('#london').click(function () {
    
    if (london == false) {
        london = true; 
        golden = false ;
        saint = false ;
    loadCubeMapFace(gl, gl.TEXTURE_CUBE_MAP_POSITIVE_X, cubeTexture, 'textures/pos-x.png');  
    loadCubeMapFace(gl, gl.TEXTURE_CUBE_MAP_NEGATIVE_X, cubeTexture, 'textures/neg-x.png');    
    loadCubeMapFace(gl, gl.TEXTURE_CUBE_MAP_POSITIVE_Y, cubeTexture, 'textures/pos-y.png');  
    loadCubeMapFace(gl, gl.TEXTURE_CUBE_MAP_NEGATIVE_Y, cubeTexture, 'textures/neg-y.png');  
    loadCubeMapFace(gl, gl.TEXTURE_CUBE_MAP_POSITIVE_Z, cubeTexture, 'textures/pos-z.png');  
    loadCubeMapFace(gl, gl.TEXTURE_CUBE_MAP_NEGATIVE_Z, cubeTexture, 'textures/neg-z.png'); 
        }
    });

    // change background to golden state bridge
    $('#goldenstate').click(function () {
    if (golden == false) {
        london = false; 
        golden = true ;
        saint = false ;
    loadCubeMapFace(gl, gl.TEXTURE_CUBE_MAP_POSITIVE_X, cubeTexture, 'textures/posx.jpg');  
    loadCubeMapFace(gl, gl.TEXTURE_CUBE_MAP_NEGATIVE_X, cubeTexture, 'textures/neg-x.jpg');    
    loadCubeMapFace(gl, gl.TEXTURE_CUBE_MAP_POSITIVE_Y, cubeTexture, 'textures/posy.jpg');  
    loadCubeMapFace(gl, gl.TEXTURE_CUBE_MAP_NEGATIVE_Y, cubeTexture, 'textures/neg-y.jpg');  
    loadCubeMapFace(gl, gl.TEXTURE_CUBE_MAP_POSITIVE_Z, cubeTexture, 'textures/posz.jpg');  
    loadCubeMapFace(gl, gl.TEXTURE_CUBE_MAP_NEGATIVE_Z, cubeTexture, 'textures/neg-z.jpg');
      }});

    // change background to church
    $('#saint').click(function () {
    if (saint == false) {
        london = false; 
        golden = false ;
        saint = true ;
    loadCubeMapFace(gl, gl.TEXTURE_CUBE_MAP_POSITIVE_X, cubeTexture, 'textures/SaintPetersBasilica/posx.jpg');  
    loadCubeMapFace(gl, gl.TEXTURE_CUBE_MAP_NEGATIVE_X, cubeTexture, 'textures/SaintPetersBasilica/negx.jpg');    
    loadCubeMapFace(gl, gl.TEXTURE_CUBE_MAP_POSITIVE_Y, cubeTexture, 'textures/SaintPetersBasilica/posy.jpg');  
    loadCubeMapFace(gl, gl.TEXTURE_CUBE_MAP_NEGATIVE_Y, cubeTexture, 'textures/SaintPetersBasilica/negy.jpg');  
    loadCubeMapFace(gl, gl.TEXTURE_CUBE_MAP_POSITIVE_Z, cubeTexture, 'textures/SaintPetersBasilica/posz.jpg');  
    loadCubeMapFace(gl, gl.TEXTURE_CUBE_MAP_NEGATIVE_Z, cubeTexture, 'textures/SaintPetersBasilica/negz.jpg');
        }
    });


}

/**
 * Main function that starts the program 
 * @param None
 * @return None
 */
function startup() {
	canvas = document.getElementById("myGLCanvas");
	gl = createGLContext(canvas);
	gl.clearColor(1.0, 1.0, 1.0, 1.0);
	gl.enable(gl.DEPTH_TEST);
	setupShaders();
    setupSkybox();
    loadTeapot() ;
    tick();
}

function tick() {
    requestAnimFrame(tick);
    draw();
    handleKeyboardInput() ;
}

