/**
 * The smallest WebGL2 wrapper that does the job: compile, link, cache uniform
 * locations. There is one program and one draw call, so anything more would be
 * scaffolding around a single triangle.
 */

export const CONTEXT_ATTRS: WebGLContextAttributes = {
  alpha: false,
  antialias: false, // nothing here has a hard edge to alias
  depth: false,
  stencil: false,
  powerPreference: "high-performance",
  preserveDrawingBuffer: false,
};

export function createContext(canvas: HTMLCanvasElement): WebGL2RenderingContext | null {
  try {
    return canvas.getContext("webgl2", CONTEXT_ATTRS);
  } catch {
    return null;
  }
}

/**
 * `#version` has to stay the very first line of the source, so defines are
 * spliced in after it rather than prepended.
 */
function withDefines(src: string, defines: Record<string, number>): string {
  const entries = Object.entries(defines);
  if (entries.length === 0) return src;

  const block = entries.map(([k, v]) => `#define ${k} ${v}`).join("\n");
  const version = /^\s*#version[^\n]*\n/.exec(src);
  if (!version) return `${block}\n${src}`;

  const head = version[0];
  return `${head}${block}\n${src.slice(head.length)}`;
}

function compile(gl: WebGL2RenderingContext, type: number, src: string): WebGLShader | null {
  const shader = gl.createShader(type);
  if (!shader) return null;

  gl.shaderSource(shader, src);
  gl.compileShader(shader);

  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const kind = type === gl.VERTEX_SHADER ? "vertex" : "fragment";
    console.error(`[singularity] ${kind} shader failed to compile\n${gl.getShaderInfoLog(shader)}`);
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

export function buildProgram(
  gl: WebGL2RenderingContext,
  vertSrc: string,
  fragSrc: string,
  defines: Record<string, number> = {},
): WebGLProgram | null {
  const vert = compile(gl, gl.VERTEX_SHADER, withDefines(vertSrc, defines));
  const frag = compile(gl, gl.FRAGMENT_SHADER, withDefines(fragSrc, defines));
  if (!vert || !frag) {
    if (vert) gl.deleteShader(vert);
    if (frag) gl.deleteShader(frag);
    return null;
  }

  const program = gl.createProgram();
  if (!program) return null;

  gl.attachShader(program, vert);
  gl.attachShader(program, frag);
  gl.linkProgram(program);

  // The shaders are reference-counted by the program; flagging them here means
  // they go as soon as it does.
  gl.deleteShader(vert);
  gl.deleteShader(frag);

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.error(`[singularity] program failed to link\n${gl.getProgramInfoLog(program)}`);
    gl.deleteProgram(program);
    return null;
  }
  return program;
}

/** Uniform lookups are string-keyed and per-frame, so they get memoised once. */
export function uniformCache(gl: WebGL2RenderingContext, program: WebGLProgram) {
  const cache = new Map<string, WebGLUniformLocation | null>();
  return (name: string): WebGLUniformLocation | null => {
    let loc = cache.get(name);
    if (loc === undefined) {
      loc = gl.getUniformLocation(program, name);
      cache.set(name, loc);
    }
    return loc;
  };
}
