import type { LanguageId } from '../languages/catalog'

export interface Example {
  id: string
  title: string
  blurb: string
  languageId: LanguageId
  fileName: string
  code: string
  stdin?: string
}

const py = (id: string, title: string, blurb: string, code: string, stdin?: string): Example => ({
  id: `py-${id}`, title, blurb, languageId: 'python', fileName: `${id}.py`, code, stdin,
})
const js = (id: string, title: string, blurb: string, code: string, stdin?: string): Example => ({
  id: `js-${id}`, title, blurb, languageId: 'javascript', fileName: `${id}.js`, code, stdin,
})

export const STARTER_PY = `# Welcome to Kalyxis.
# Write Python here and press Run.
name = "world"
print(f"Hello, {name}!")
`

export const STARTER_JS = `// Write JavaScript here and press Run.
const name = "world"
console.log(\`Hello, \${name}!\`)
`

export const STARTER_HTML = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Kalyxis page</title>
    <style>
      body { font-family: system-ui, sans-serif; display: grid; place-items: center; min-height: 100vh; margin: 0; background: #0b0d12; color: #e8e4d8; }
      button { font: inherit; padding: 12px 22px; border: 1px solid #d6c38f; background: transparent; color: #d6c38f; border-radius: 2px; }
    </style>
  </head>
  <body>
    <main>
      <h1 id="title">Hello, evening.</h1>
      <button id="tap">Tap me</button>
    </main>
    <script>
      let taps = 0
      document.getElementById('tap').addEventListener('click', () => {
        taps += 1
        document.getElementById('title').textContent = 'Taps: ' + taps
        console.log('tapped', taps)
      })
    </script>
  </body>
</html>
`

export const WELCOME_MD = `# Welcome to Kalyxis

A pocket code editor for the hour after dusk. Everything you write is stored on this device.

## Quick start

- Open the file list with the menu button at the top left.
- Tap **Run** to execute Python, JavaScript or an HTML page. Output appears in the Console.
- Programs that read input take their lines from the **Input** tab, one value per line.
- The key bar above the keyboard has brackets, quotes, Tab and cursor keys.
- Open the command palette from the dots menu to find every command.

## Good to know

- Auto save is on, so closing the app never loses work.
- Use **Export** in the file list to download your workspace as a zip file.
- Kalyxis works offline after the first visit and can be added to your home screen.
`

export const EXAMPLES: Example[] = [
  py('hello', 'Hello, variables', 'Print and f-strings', STARTER_PY),
  py('loops', 'Loops and ranges', 'for, range, accumulators', `total = 0
for i in range(1, 6):
    total += i
    print(i, "->", total)
print("sum:", total)
`),
  py('functions', 'Functions', 'def, defaults, return', `def greet(name, mark="!"):
    return "Hello, " + name + mark

print(greet("Ada"))
print(greet("Bo", "?"))
`),
  py('data', 'Lists and dictionaries', 'Comprehensions, sorting', `words = ["raven", "ember", "lumen", "quartz"]
print([w.upper() for w in words if len(w) > 4])
print({w: len(w) for w in words})
print(sorted(words, key=len, reverse=True))
`),
  py('classes', 'Classes', 'Objects and methods', `class Counter:
    def __init__(self):
        self.count = 0

    def tick(self):
        self.count += 1
        return self.count

c = Counter()
for _ in range(3):
    print(c.tick())
`),
  py('input', 'Ask for input()', 'Uses the Input tab', `name = input("What is your name? ")
age = int(input("How old are you? "))
print(f"{name} will be {age + 1} next year.")
`, 'Ada\n30'),
  py('errors', 'Handle errors', 'try and except', `for text in ["12", "abc", "7"]:
    try:
        print(int(text) * 2)
    except ValueError:
        print(text, "is not a number")
`),
  py('fibonacci', 'Recursion and memo', 'Fast Fibonacci', `memo = {}

def fib(n):
    if n < 2:
        return n
    if n not in memo:
        memo[n] = fib(n - 1) + fib(n - 2)
    return memo[n]

print([fib(n) for n in range(12)])
print(fib(80))
`),
  js('hello', 'Hello, console', 'console.log and template strings', STARTER_JS),
  js('arrays', 'Array methods', 'map, filter, reduce', `const nums = [1, 2, 3, 4, 5, 6]
const evens = nums.filter((n) => n % 2 === 0)
console.log("evens:", evens)
console.log("squares:", nums.map((n) => n * n))
console.log("sum:", nums.reduce((a, b) => a + b, 0))
console.log({ count: nums.length, first: nums[0], last: nums.at(-1) })
`),
  js('async', 'Async and timers', 'await, setTimeout, Promise.all', `const wait = (ms, value) => new Promise((resolve) => setTimeout(() => resolve(value), ms))

console.log("start")
const results = await Promise.all([wait(300, "first"), wait(100, "second"), wait(200, "third")])
console.log("results:", results)
console.log("done")
`),
  js('classes', 'Classes', 'Fields, getters, inheritance', `class Shape {
  constructor(name) { this.name = name }
  area() { return 0 }
  describe() { return \`\${this.name} with area \${this.area().toFixed(2)}\` }
}

class Circle extends Shape {
  constructor(r) { super("Circle"); this.r = r }
  area() { return Math.PI * this.r ** 2 }
}

console.log(new Circle(2).describe())
console.log(new Shape("Blank").describe())
`),
  js('input', 'Ask with prompt()', 'Uses the Input tab', `const name = prompt("What is your name? ")
const age = Number(prompt("How old are you? "))
console.log(\`\${name} will be \${age + 1} next year.\`)
`, 'Ada\n30'),
  js('modules', 'Import from a URL', 'ES modules work too', `import { sortBy } from "https://cdn.jsdelivr.net/npm/lodash-es@4.17.21/lodash.js"

const people = [{ name: "Cy", age: 41 }, { name: "Ada", age: 36 }, { name: "Bo", age: 29 }]
console.log(sortBy(people, "age").map((p) => p.name))
`),
  {
    id: 'html-page', title: 'HTML page', blurb: 'Preview with live console', languageId: 'html', fileName: 'index.html', code: STARTER_HTML,
  },
  {
    id: 'html-canvas', title: 'Canvas drawing', blurb: 'Animated rings on a canvas', languageId: 'html', fileName: 'canvas.html', code: `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <style>
      html, body { margin: 0; height: 100%; background: #08090c; }
      canvas { display: block; width: 100%; height: 100%; }
    </style>
  </head>
  <body>
    <canvas id="c"></canvas>
    <script>
      const canvas = document.getElementById('c')
      const ctx = canvas.getContext('2d')
      function resize() { canvas.width = innerWidth * devicePixelRatio; canvas.height = innerHeight * devicePixelRatio }
      addEventListener('resize', resize)
      resize()
      function frame(t) {
        const { width: w, height: h } = canvas
        ctx.clearRect(0, 0, w, h)
        ctx.strokeStyle = '#d6c38f'
        ctx.lineWidth = 1.5 * devicePixelRatio
        for (let i = 1; i <= 7; i++) {
          const r = (Math.min(w, h) / 16) * i + Math.sin(t / 700 + i) * 6 * devicePixelRatio
          ctx.globalAlpha = 1 - i / 8
          ctx.beginPath()
          ctx.arc(w / 2, h / 2, r, 0, Math.PI * 2)
          ctx.stroke()
        }
        requestAnimationFrame(frame)
      }
      requestAnimationFrame(frame)
      console.log('canvas ready')
    </script>
  </body>
</html>
`,
  },
  { id: 'blank', title: 'Blank file', blurb: 'Start from nothing', languageId: 'plaintext', fileName: 'untitled.txt', code: '' },
]
