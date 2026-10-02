# Security

Pytml executes Python in the browser through Pyodide/WebAssembly. Python code runs with the normal capabilities of the page that loaded Pytml.

Pytml does not intentionally send Python source, DOM contents, form values, or Python output to a Pytml backend. Pyodide and packages may be downloaded from their configured CDN/package endpoints.

Do not execute untrusted Pytml code on pages that contain secrets or privileged browser state.

For security reports, contact the maintainers privately rather than posting sensitive details publicly.
