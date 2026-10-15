// GLSL for the shelf plane, the sprites and the dust.
// Colour maths happens in linear space: the photo is linearised (pow 2.2), relit, then re-encoded.

export const DATA_W = 1024; // spine data texture width (max spine id + 1)

const COMMON = /* glsl */ `
  uniform sampler2D uId;
  uniform sampler2D uSpineData;
  uniform float uFrame;
  uniform vec4 uWave;        // start, sweep, rowDelay, pulse
  uniform float uWaveAmp;

  float decodeId(vec2 uv) {
    vec4 t = texture2D(uId, uv);
    return floor(t.r * 255.0 + 0.5) + floor(t.g * 255.0 + 0.5) * 256.0;
  }
  float decodeType(vec2 uv) { return floor(texture2D(uId, uv).b * 255.0 + 0.5); }
  vec4 spineData(float id, float row) {
    return texture2D(uSpineData, vec2((id + 0.5) / ${DATA_W}.0, (row + 0.5) / 2.0));
  }
  // 0..1 lift of a standing spine for the piano-key wave
  float waveLift(float id) {
    if (id < 0.5) return 0.0;
    vec4 d0 = spineData(id, 0.0);
    if (d0.z < 0.5 || d0.z > 1.5) return 0.0;          // only standing spines move
    vec4 d1 = spineData(id, 1.0);
    float delay = uWave.x + d1.x * uWave.z + d0.x * uWave.y;
    float t = (uFrame - delay) / uWave.w;
    if (t <= 0.0 || t >= 1.0) return 0.0;
    float s = sin(3.14159265 * t);
    return s * s;
  }
`;

export const LIGHTING = /* glsl */ `
  uniform vec3 uLightPos;
  uniform float uLightIntensity;
  uniform float uLightRadius;
  uniform float uAmbient;
  uniform vec3 uWarm;
  uniform vec3 uAmbientColor;
  uniform float uSpecPower;
  uniform float uSpec;
  uniform float uExposure;

  vec3 toLinear(vec3 c) { return pow(c, vec3(2.2)); }
  vec3 toGamma(vec3 c) { return pow(max(c, 0.0), vec3(1.0 / 2.2)); }

  // returns diffuse light (rgb) and writes the specular term
  vec3 relight(vec3 world, vec3 N, float gloss, out float spec, out float atten) {
    vec3 Lv = uLightPos - world;
    float dist = length(Lv);
    vec3 L = Lv / dist;
    atten = 1.0 / (1.0 + pow(dist / uLightRadius, 2.0));
    float lambert = max(dot(N, L), 0.0);
    // half-lambert wrap keeps the photo's own shading readable in the dark parts
    float wrapD = lambert * 0.8 + 0.2 * clamp(dot(N, L) * 0.5 + 0.5, 0.0, 1.0);
    vec3 V = normalize(cameraPosition - world);
    vec3 H = normalize(L + V);
    spec = pow(max(dot(N, H), 0.0), uSpecPower) * gloss * uSpec * atten * uLightIntensity;
    return uAmbient * uAmbientColor + uLightIntensity * atten * wrapD * uWarm;
  }
`;

export const shelfVertex = /* glsl */ `
  uniform sampler2D uDepth;
  uniform float uDepthScale;
  ${COMMON}
  varying vec2 vUv;
  varying vec3 vWorld;

  void main() {
    vUv = uv;
    vec2 mapUv = vec2(uv.x, 1.0 - uv.y);           // maps are stored top-down
    float d = texture2D(uDepth, mapUv).r;
    float id = decodeId(mapUv);
    vec3 p = position;
    p.z += d * uDepthScale + waveLift(id) * uWaveAmp;
    vec4 w = modelMatrix * vec4(p, 1.0);
    vWorld = w.xyz;
    gl_Position = projectionMatrix * viewMatrix * w;
  }
`;

export const shelfFragment = /* glsl */ `
  uniform sampler2D uColor;
  uniform sampler2D uNormal;
  uniform sampler2D uCell;
  uniform vec2 uMapSize;
  uniform float uNormalStrength;
  uniform float uBloom;
  uniform float uVignette;
  uniform float uGrain;
  uniform float uWaveBrighten;
  uniform vec2 uResolution;
  uniform vec4 uCellTint[35];
  ${COMMON}
  ${LIGHTING}
  varying vec2 vUv;
  varying vec3 vWorld;

  vec3 normalAt(vec2 mapUv) {
    vec3 n = texture2D(uNormal, mapUv).xyz * 2.0 - 1.0;
    return normalize(vec3(n.xy * uNormalStrength, n.z));
  }
  float glossAt(vec2 mapUv) {
    float t = decodeType(mapUv);
    if (t > 3.5) return 0.18;                         // varnished frame
    if (t < 0.5 || t > 2.5) return 0.0;
    return spineData(decodeId(mapUv), 1.0).z;
  }
  float hash12(vec2 p) {
    vec3 p3 = fract(vec3(p.xyx) * 0.1031);
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.x + p3.y) * p3.z);
  }

  void main() {
    vec2 mapUv = vec2(vUv.x, 1.0 - vUv.y);
    vec3 albedo = toLinear(texture2D(uColor, mapUv).rgb);
    vec3 N = normalAt(mapUv);
    float gloss = glossAt(mapUv);
    float lift = waveLift(decodeId(mapUv));

    float spec, atten;
    vec3 light = relight(vWorld, N, gloss, spec, atten);
    light *= 1.0 + lift * uWaveBrighten;               // a pushed-out spine catches more light
    vec3 col = albedo * light * uExposure + spec * uWarm;

    // cheap bloom on highlights: specular of a ring of neighbours
    if (uBloom > 0.0) {
      float glow = 0.0;
      vec2 px = 1.0 / uMapSize;
      for (int i = 0; i < 8; i++) {
        float a = float(i) * 0.785398;
        vec2 o = vec2(cos(a), sin(a)) * px * 7.0;
        float g = glossAt(mapUv + o);
        if (g > 0.0) {
          float s2, a2;
          relight(vWorld, normalAt(mapUv + o), g, s2, a2);
          glow += s2;
        }
      }
      col += uBloom * glow / 8.0 * uWarm;
    }

    // per-cell tint (episodes): rgb multiplier, a = amount
    float cell = floor(texture2D(uCell, mapUv).r * 255.0 + 0.5) - 1.0;
    if (cell > -0.5) {
      vec4 tint = uCellTint[int(cell)];
      col = mix(col, col * tint.rgb, tint.a);
    }

    vec3 outc = toGamma(col);
    vec2 q = gl_FragCoord.xy / uResolution - 0.5;
    outc *= 1.0 - uVignette * smoothstep(0.15, 0.75, length(q * vec2(1.0, 0.85)));
    outc += (hash12(gl_FragCoord.xy + fract(uFrame * 0.6180339) * vec2(171.0, 113.0)) - 0.5) * uGrain;
    gl_FragColor = vec4(outc, 1.0);
  }
`;

export const spriteVertex = /* glsl */ `
  uniform sampler2D uSpriteDepth;
  uniform float uDepthScale;
  varying vec2 vUv;
  varying vec3 vWorld;
  void main() {
    vUv = uv;
    vec3 p = position;
    p.z += texture2D(uSpriteDepth, vec2(uv.x, 1.0 - uv.y)).r * uDepthScale;
    vec4 w = modelMatrix * vec4(p, 1.0);
    vWorld = w.xyz;
    gl_Position = projectionMatrix * viewMatrix * w;
  }
`;

export const spriteFragment = /* glsl */ `
  uniform sampler2D uSprite;
  uniform sampler2D uSpriteDepth;
  uniform float uGloss;
  uniform float uVignette;
  uniform float uGrain;
  uniform float uFrame;
  uniform float uBrighten;
  uniform vec2 uResolution;
  uniform vec2 uTexel;
  ${LIGHTING}
  varying vec2 vUv;
  varying vec3 vWorld;
  float hash12(vec2 p) {
    vec3 p3 = fract(vec3(p.xyx) * 0.1031);
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.x + p3.y) * p3.z);
  }
  void main() {
    vec2 st = vec2(vUv.x, 1.0 - vUv.y);
    vec4 c = texture2D(uSprite, st);
    if (c.a < 0.01) discard;
    float dl = texture2D(uSpriteDepth, st - vec2(uTexel.x, 0.0)).r;
    float dr = texture2D(uSpriteDepth, st + vec2(uTexel.x, 0.0)).r;
    float du = texture2D(uSpriteDepth, st - vec2(0.0, uTexel.y)).r;
    float dd = texture2D(uSpriteDepth, st + vec2(0.0, uTexel.y)).r;
    vec3 N = normalize(vec3((dl - dr) * 6.0, (dd - du) * 6.0, 1.0));
    float spec, atten;
    vec3 light = relight(vWorld, N, uGloss, spec, atten) * (1.0 + uBrighten);
    vec3 col = toLinear(c.rgb) * light * uExposure + spec * uWarm;
    vec3 outc = toGamma(col);
    vec2 q = gl_FragCoord.xy / uResolution - 0.5;
    outc *= 1.0 - uVignette * smoothstep(0.15, 0.75, length(q * vec2(1.0, 0.85)));
    outc += (hash12(gl_FragCoord.xy + fract(uFrame * 0.6180339) * vec2(171.0, 113.0)) - 0.5) * uGrain;
    gl_FragColor = vec4(outc, c.a);
  }
`;

export const dustVertex = /* glsl */ `
  attribute float aBright;
  attribute float aSize;
  uniform float uPx;
  varying float vBright;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = aSize * uPx / max(0.2, -mv.z);
    vBright = aBright;
    gl_Position = projectionMatrix * mv;
  }
`;

export const dustFragment = /* glsl */ `
  uniform vec3 uWarm;
  varying float vBright;
  void main() {
    vec2 c = gl_PointCoord - 0.5;
    float r = length(c);
    float a = smoothstep(0.5, 0.0, r);
    a *= a;
    gl_FragColor = vec4(uWarm * vBright * a, 1.0);
  }
`;
