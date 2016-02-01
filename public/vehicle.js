
'use strict';

Physijs.scripts.worker = '/physijs_worker.js';
Physijs.scripts.ammo = '/js/ammo.js';

function initScene() {
  var
    ground_material, box_material,
    renderer, render_stats, physics_stats, scene, ground, light, camera,
    vehicles, loader,
    wx, wy, frontWheels, rearWheels,
    wall_h, wall_t, arena_h, arena_w;

  renderer = new THREE.WebGLRenderer({ antialias: false });
  renderer.setSize( window.innerWidth, window.innerHeight );
  renderer.shadowMap.enabled = false;
  renderer.shadowMapSoft = false;
  document.getElementById( 'viewport' ).appendChild( renderer.domElement );

  render_stats = new Stats();
  render_stats.domElement.style.position = 'absolute';
  render_stats.domElement.style.top = '1px';
  render_stats.domElement.style.zIndex = 100;
  document.getElementById( 'viewport' ).appendChild( render_stats.domElement );

  physics_stats = new Stats();
  physics_stats.domElement.style.position = 'absolute';
  physics_stats.domElement.style.top = '50px';
  physics_stats.domElement.style.zIndex = 100;
  document.getElementById( 'viewport' ).appendChild( physics_stats.domElement );

  var room = location.search;

  if (true) {
    frontWheels = [0];
    rearWheels = [1, 2];
    wx = [0, -1.6, 1.6];
    wy = [3.3, -3.2, -3.2];
  } else {
    frontWheels = [0, 1];
    rearWheels = [2, 3];
    wx = [-1.8, 1.8, -1.8, 1.8];
    wy = [3.3, 3.3, -3.2, -3.2];
  }

  scene = new Physijs.Scene();
  scene.setGravity(new THREE.Vector3( 0, -40, 0 ));

  camera = new THREE.PerspectiveCamera(
    50,
    window.innerWidth / window.innerHeight,
    1,
    1000
  );
  scene.add(camera);

  function setCameraPosition() {
    var r = 0.6, theta = 35 * (Math.PI / 180);
    var cosine = Math.cos(theta), sine = Math.sin(theta);
    var pos = new THREE.Vector3(
        arena_w * r * cosine, arena_w * sine, 0
        );
    camera.position.copy(pos);
    camera.lookAt( new THREE.Vector3(0, 0, 0) );
  }

  setCameraPosition();

  // SETUP ORBIT CONTROLS OF THE CAMERA
  var controls = new THREE.OrbitControls(camera);

  // Handle resize
  function resize() {
		renderer.setSize(window.innerWidth,window.innerHeight);
		camera.aspect = window.innerWidth/window.innerHeight;
		camera.updateProjectionMatrix();
	}

	window.addEventListener('resize', resize);

	resize();

	window.onscroll = function() { window.scrollTo(0,0); }

  // Light
  light = new THREE.DirectionalLight( 0xFFFFFF );
  light.position.set(20, 20, -15);
  light.target.position.copy(new THREE.Vector3(0, 0, 0));
  light.castShadow = true;
  light.shadowCameraLeft = -150;
  light.shadowCameraTop = -150;
  light.shadowCameraRight = 150;
  light.shadowCameraBottom = 150;
  light.shadowCameraNear = 20;
  light.shadowCameraFar = 400;
  light.shadowBias = -.001;
  light.shadowMapWidth = light.shadowMapHeight = 512;
  light.shadowDarkness = .6;
  scene.add(light);

  light = new THREE.AmbientLight(0x403030);
  scene.add(light);

  wall_h = 12;
  wall_t = 0.5;
  arena_h = 120;
  arena_w = 220;

  // Loader
  loader = new THREE.TextureLoader();

  // Materials
  ground_material = Physijs.createMaterial(
    new THREE.MeshLambertMaterial({ map: loader.load( 'images/rocks.jpg' ) }),
    .95, // high friction
    .4 // low restitution
  );
  ground_material.map.wrapS = ground_material.map.wrapT = THREE.RepeatWrapping;
  ground_material.map.repeat.set( 3, 3 );

  box_material = Physijs.createMaterial(
    new THREE.MeshLambertMaterial({ map: loader.load( 'images/plywood.jpg' ) }),
    .4, // low friction
    .6 // high restitution
  );
  box_material.map.wrapS = ground_material.map.wrapT = THREE.RepeatWrapping;
  box_material.map.repeat.set( .25, .25 );

  // Ground
  var NoiseGen = new SimplexNoise;

  var ground_geometry = new THREE.PlaneGeometry(arena_h + 2, arena_w + 2, 2, 2);
  for ( var i = 0; i < ground_geometry.vertices.length; i++ ) {
    var vertex = ground_geometry.vertices[i];
    //vertex.y = NoiseGen.noise( vertex.x / 30, vertex.z / 30 ) * 1;
  }
  ground_geometry.computeFaceNormals();
  ground_geometry.computeVertexNormals();

  // If your plane is not square as far as face count then the HeightfieldMesh
  // takes two more arguments at the end: # of x faces and # of z faces that were passed to THREE.PlaneMaterial
  ground = new Physijs.HeightfieldMesh(
      ground_geometry,
      ground_material,
      0 // mass
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add( ground );

  function mkSphere(r, x, y, z, m) {
    var box = new Physijs.SphereMesh(
      new THREE.SphereGeometry(r, 16, 16),
      box_material,
      m
    );

    box.castShadow = box.receiveShadow = true;
    box.position.set(x, y, z);
    return box;
  }

  function mkBox(a, b, c, x, y, z, m) {
    var box = new Physijs.BoxMesh(
      new THREE.BoxGeometry(a, b, c),
      box_material,
      m
    );

    box.castShadow = box.receiveShadow = true;
    box.position.set(x, y, z);
    return box;
  }

  scene.add(mkSphere(3, 0, 15, 20, 0.4));
  scene.add(mkBox(arena_h, wall_h, wall_t, 0, wall_h / 2, arena_w / 2, 0));
  scene.add(mkBox(arena_h, wall_h, wall_t, 0, wall_h / 2, -arena_w / 2, 0));

  scene.add(mkBox(wall_t, wall_h, arena_w, arena_h / 2, wall_h / 2, 0, 0));
  scene.add(mkBox(wall_t, wall_h, arena_w, -arena_h / 2, wall_h / 2, 0, 0));

  var number_of_items = 0; // CHANGE: the number of boxes in the simulation
  for ( i = 0; i < number_of_items; i++ ) {
    var size = Math.round(Math.random() * 5 + 5);
    var
      x = Math.random() * 25 - 50,
      y = Math.random() * 5 + 5,
      z = Math.random() * 25 - 50;

    scene.add(mkBox(size, size, size, x, y, z));
  }


  var json_loader = new THREE.JSONLoader();

  // http://stackoverflow.com/a/3426956
  function hashCode(str) { // java String#hashCode
    var hash = 0;
    for (var i = 0; i < str.length; i++) {
      hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    return hash;
  }

  function intToRGB(i){
    var c = (i & 0x00FFFFFF)
      .toString(16)
      .toUpperCase();

    return "00000".substring(0, 6 - c.length) + c;
  }

  function mkVehicle(name, x, z) {
    var ws, telemetry, vehicle, input;
    json_loader.load( "models/mustang.js", function( car, car_materials ) {
      json_loader.load( "models/mustang_wheel.js", function( wheel, wheel_materials ) {

        ws = new WebSocket("ws://" + document.location.host + "/read/steering" + room + "-" + name);
        telemetry = new WebSocket("ws://" + document.location.host + "/write/telemetry" + room + "-" + name);

        car_materials[4].color.setStyle('#' + intToRGB(hashCode(name + ":" + x + "," + "z")));
        var mesh = new Physijs.BoxMesh(
          car,
          new THREE.MeshFaceMaterial(car_materials),
          90
        );

        mesh.position.x = x || 0;
        mesh.position.z = z || 0;
        mesh.position.y = 2;
        mesh.castShadow = mesh.receiveShadow = false;

        vehicle = new Physijs.Vehicle(
          mesh, new Physijs.VehicleTuning(
            200.0, //suspension_stiffness
            200.0, //suspension_compression
            10.0, //suspension_damping
            500, //max_suspension_travel
            9.2, //friction_slip
            2000 //max_suspension_force
            )
          );
        scene.add( vehicle );

        var wheel_material = new THREE.MeshFaceMaterial( wheel_materials );

        for ( var i = 0; i < wx.length; i++ ) {
          vehicle.addWheel(
            wheel,
            wheel_material,
            new THREE.Vector3(wx[i], -1, wy[i]),
            new THREE.Vector3(0, -1, 0),
            new THREE.Vector3(-1, 0, 0),
            0.5, //suspension_rest_length
            0.7,
            i < 2 ? false : true
          );
        }

        input = { power: null, steering: 0 };

        ws.onmessage = function(evt) {
          if (!evt.data) return;
          if (evt.data.charAt(0) == 'a') {
            var x = parseFloat(evt.data.slice(1));
            input.power = x;
          } else if (evt.data.charAt(0) == 'b') {
            var x = parseFloat(evt.data.slice(1));
            input.power = -x;
          } else {
            var angle = parseFloat(evt.data);
            input.steering = -angle / 80;
            input.power = null;
          }
        };

      scene.addEventListener('update', function() {
        var vel = vehicle.mesh.getLinearVelocity();
        var spd = vel.length();
        if (isNaN(spd)) spd = 0;
        if (telemetry && telemetry.readyState === 1)
          telemetry.send('s' + spd);

        if ( input && vehicle ) {
          if (input.steering < -.6) input.steering = -.6;
          if (input.steering > .6) input.steering = .6;

          frontWheels.forEach(function(w) { vehicle.setSteering(input.steering, w); });
          //rearWheels.forEach(function(w) { vehicle.setSteering(-0.1*input.steering, w); });

          if (input.power === null) {
            vehicle.applyEngineForce(0);
            vehicle.setBrake(0);
          }
          else if (input.power > 0) {
            vehicle.applyEngineForce(4600 * input.power);
            vehicle.setBrake(0);
          } else if (input.power < 0) {
            if (spd < 5) {
              vehicle.applyEngineForce(2000 * input.power);
            } else {
              frontWheels.forEach(function(w) { vehicle.setBrake(-85 * input.power, w); });
              rearWheels.forEach(function(w) { vehicle.setBrake(-65 * input.power, w); });
            }
          }
        }
      });

      return vehicle;

      });
    });
  }
  // END


  mkVehicle("A", 10, 1);
  mkVehicle("B", 5, 3);
  mkVehicle("C", 0, 5);
  mkVehicle("D", -5, 3);

  function render() {
    requestAnimationFrame( render );
    renderer.render( scene, camera );
    render_stats.update();
  }

  scene.addEventListener('update', function() {
    scene.simulate( undefined, 5 );
    physics_stats.update();
  });
  requestAnimationFrame( render );
  scene.simulate();
  setCameraPosition();
};

window.onload = initScene;
