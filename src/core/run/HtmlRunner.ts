import { Runner, type OutputSink, type RunOutcome, type RunRequest } from './Runner'

const BRIDGE = `(function(){
  var post=function(k,t){try{parent.postMessage({__kalyxis:true,kind:k,text:t},'*')}catch(e){}};
  var fmt=function(a){return Array.prototype.map.call(a,function(v){
    if(typeof v==='string')return v;
    if(v instanceof Error)return v.stack||String(v);
    try{return JSON.stringify(v)}catch(e){return String(v)}}).join(' ')+'\\n'};
  ['log','info','debug'].forEach(function(n){console[n]=function(){post('stdout',fmt(arguments))}});
  ['warn','error'].forEach(function(n){console[n]=function(){post('stderr',fmt(arguments))}});
  window.addEventListener('error',function(e){post('stderr',(e.message||'Error')+(e.lineno?' (line '+e.lineno+')':'')+'\\n')});
  window.addEventListener('unhandledrejection',function(e){post('stderr','Uncaught (in promise) '+(e.reason&&e.reason.stack||e.reason)+'\\n')});
})();`

const isRelative = (url: string) => !!url && !/^([a-z][a-z0-9+.-]*:|\/\/|#)/i.test(url)

/** Builds a self contained page for the sandboxed preview frame and relays its console output. */
export class HtmlRunner extends Runner {
  readonly id = 'html'
  readonly label = 'HTML preview'
  readonly kind = 'preview' as const
  readonly languages = ['html'] as const

  private listener: ((e: MessageEvent) => void) | null = null

  async run(request: RunRequest, sink: OutputSink): Promise<RunOutcome> {
    const started = performance.now()
    this.detach()
    const doc = new DOMParser().parseFromString(request.code, 'text/html')
    const read = request.readRelative
    if (read) {
      for (const link of Array.from(doc.querySelectorAll('link[rel~="stylesheet"][href]'))) {
        const href = link.getAttribute('href') ?? ''
        if (!isRelative(href)) continue
        const css = await read(href)
        if (css === null) continue
        const style = doc.createElement('style')
        style.textContent = css
        link.replaceWith(style)
      }
      for (const script of Array.from(doc.querySelectorAll('script[src]'))) {
        const src = script.getAttribute('src') ?? ''
        if (!isRelative(src)) continue
        const js = await read(src)
        if (js === null) continue
        const inline = doc.createElement('script')
        const type = script.getAttribute('type')
        if (type) inline.setAttribute('type', type)
        inline.textContent = js.replace(/<\/script/gi, '<\\/script')
        script.replaceWith(inline)
      }
    }
    const bridge = doc.createElement('script')
    bridge.textContent = BRIDGE
    doc.head.prepend(bridge)
    if (!doc.querySelector('meta[name="viewport"]')) {
      const meta = doc.createElement('meta')
      meta.setAttribute('name', 'viewport')
      meta.setAttribute('content', 'width=device-width, initial-scale=1')
      doc.head.prepend(meta)
    }
    this.listener = (e: MessageEvent) => {
      const d = e.data as { __kalyxis?: boolean; kind?: string; text?: string } | null
      if (!d || d.__kalyxis !== true || typeof d.text !== 'string') return
      sink.write(d.kind === 'stderr' ? 'stderr' : 'stdout', d.text)
    }
    window.addEventListener('message', this.listener)
    return { ms: Math.round(performance.now() - started), previewHtml: `<!doctype html>\n${doc.documentElement.outerHTML}` }
  }

  cancel(): void {
    this.detach()
  }

  private detach(): void {
    if (this.listener) window.removeEventListener('message', this.listener)
    this.listener = null
  }
}
