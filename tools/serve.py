"""Static dev server that tells the browser never to cache.

The stock `python -m http.server` sends no cache headers, so browsers reuse old copies of
hero.js and the hands image after an edit. Run from the project root:  python tools/serve.py
"""
import functools
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer


class NoStore(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()


if __name__ == '__main__':
    handler = functools.partial(NoStore, directory='.')
    print('http://localhost:5174/')
    ThreadingHTTPServer(('127.0.0.1', 5174), handler).serve_forever()
