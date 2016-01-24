
'use strict';

Physijs.scripts.worker = '/physijs_worker.js';
Physijs.scripts.ammo = '/js/ammo.js';

var initScene, render,
  ground_material, box_material,
  renderer, render_stats, physics_stats, scene, ground, light, camera,
  vehicle_body, vehicle, loader, ws, telemetry,
  wx, wy, frontWheels, rearWheels, wall_h, wall_t, arena_h, arena_w;


initScene = function() {

  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize( window.innerWidth, window.innerHeight );
  renderer.shadowMap.enabled = true;
  renderer.shadowMapSoft = true;
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
  ws = new WebSocket("ws://" + document.location.host + "/read/steering" + room);
  telemetry = new WebSocket("ws://" + document.location.host + "/write/telemetry" + room);

  if (true) {
    frontWheels = [0];
    rearWheels = [1, 2];
    wx = [0, -1.8, 1.8];
    wy = [3.3, -3.2, -3.2];
  } else {
    frontWheels = [0, 1];
    rearWheels = [2, 3];
    wx = [-1.8, 1.8, -1.8, 1.8];
    wy = [3.3, 3.3, -3.2, -3.2];
  }

  scene = new Physijs.Scene();
  scene.setGravity(new THREE.Vector3( 0, -40, 0 ));
  scene.addEventListener(
    'update',
    function() {
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
          vehicle.applyEngineForce(1500 * input.power);
          vehicle.setBrake(0);
        } else if (input.power < 0) {
          if (spd < 4) {
            vehicle.applyEngineForce(500 * input.power);
          } else {
            frontWheels.forEach(function(w) { vehicle.setBrake(-35 * input.power, w); });
            rearWheels.forEach(function(w) { vehicle.setBrake(-25 * input.power, w); });
          }
        }
      }

      scene.simulate( undefined, 5 );
      physics_stats.update();
    }
  );

  camera = new THREE.PerspectiveCamera(
    50,
    window.innerWidth / window.innerHeight,
    1,
    1000
  );
  scene.add( camera );

  // Light
  light = new THREE.DirectionalLight( 0xFFFFFF );
  light.position.set( 20, 20, -15 );
  light.target.position.copy( scene.position );
  light.castShadow = true;
  light.shadowCameraLeft = -150;
  light.shadowCameraTop = -150;
  light.shadowCameraRight = 150;
  light.shadowCameraBottom = 150;
  light.shadowCameraNear = 20;
  light.shadowCameraFar = 400;
  light.shadowBias = -.0001
  light.shadowMapWidth = light.shadowMapHeight = 2048;
  light.shadowDarkness = .6;
  scene.add( light );

  wall_h = 4;
  wall_t = 0.1;
  arena_h = 100;
  arena_w = 170;

  var input;

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

  json_loader.load( "models/mustang.js", function( car, car_materials ) {
    json_loader.load( "models/mustang_wheel.js", function( wheel, wheel_materials ) {
      var mesh = new Physijs.BoxMesh(
        car,
        new THREE.MeshFaceMaterial(car_materials),
        90
      );
      mesh.position.y = 3;
      mesh.castShadow = mesh.receiveShadow = true;

      vehicle = new Physijs.Vehicle(mesh, new Physijs.VehicleTuning(
        20.0, //suspension_stiffness
        200.0, //suspension_compression
        10.0, //suspension_damping
        500, //max_suspension_travel
        9.2, //friction_slip
        2000 //max_suspension_force
      ));
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

    });
  });

  requestAnimationFrame( render );
  scene.simulate();
};

render = function() {
  requestAnimationFrame( render );
  if ( vehicle ) {
    var r = 0.6, theta = 35 * (Math.PI / 180);
    var cosine = Math.cos(theta), sine = Math.sin(theta);
    // camera.position.copy( vehicle.mesh.position ).add
    var pos =new THREE.Vector3(
        arena_w * r * cosine, arena_w * sine, 0
        );
    camera.position.copy(pos);
    // camera.lookAt( vehicle.mesh.position );
    camera.lookAt( new THREE.Vector3(0, 0, 0) );

    light.target.position.copy( vehicle.mesh.position );
    //light.position.addVectors( light.target.position, new THREE.Vector3( 20, 20, -15 ) );
  }
  renderer.render( scene, camera );
  render_stats.update();
};

window.onload = initScene;
