export interface TerminalExample {
  id: string
  title: string
  blurb: string
  code: string
  stdin?: string
}

export const TERMINAL_STARTER = `# Welcome to the terminal.
# Write Python here and press Run.
name = "world"
print(f"Hello, {name}!")
`

export const TERMINAL_EXAMPLES: TerminalExample[] = [
  { id: 'hello', title: 'Hello, variables', blurb: 'Print and f-strings', code: TERMINAL_STARTER },
  { id: 'loops', title: 'Loops and ranges', blurb: 'for, range, accumulators', code: `total = 0\nfor i in range(1, 6):\n    total += i\n    print(i, "->", total)\nprint("sum:", total)\n` },
  { id: 'funcs', title: 'Functions', blurb: 'def, defaults, return', code: `def greet(name, mark="!"):\n    return "Hello, " + name + mark\n\nprint(greet("Ada"))\nprint(greet("Bo", "?"))\n` },
  { id: 'data', title: 'Lists and dictionaries', blurb: 'comprehensions, sorting', code: `words = ["raven", "ember", "lumen", "quartz"]\nprint([w.upper() for w in words if len(w) > 4])\nprint({w: len(w) for w in words})\nprint(sorted(words, key=len, reverse=True))\n` },
  { id: 'classes', title: 'Classes', blurb: 'objects and methods', code: `class Counter:\n    def __init__(self):\n        self.count = 0\n\n    def tick(self):\n        self.count += 1\n        return self.count\n\nc = Counter()\nfor _ in range(3):\n    print(c.tick())\n` },
  { id: 'input', title: 'Ask for input()', blurb: 'uses the Input panel', code: `name = input("What is your name? ")\nage = int(input("How old are you? "))\nprint(f"{name} will be {age + 1} next year.")\n`, stdin: 'Ada\n30' },
  { id: 'errors', title: 'Handle errors', blurb: 'try / except', code: `for text in ["12", "abc", "7"]:\n    try:\n        print(int(text) * 2)\n    except ValueError:\n        print(text, "is not a number")\n` },
  { id: 'recursion', title: 'Recursion and memo', blurb: 'fast Fibonacci', code: `memo = {}\n\ndef fib(n):\n    if n < 2:\n        return n\n    if n not in memo:\n        memo[n] = fib(n - 1) + fib(n - 2)\n    return memo[n]\n\nprint([fib(n) for n in range(12)])\nprint(fib(80))\n` },
  { id: 'blank', title: 'Blank page', blurb: 'start from nothing', code: '' },
]
