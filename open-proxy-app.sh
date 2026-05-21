#!/bin/bash
# Opens TFT Proxy in default browser (macOS)
open "http://127.0.0.1:5173" 2>/dev/null || xdg-open "http://127.0.0.1:5173" 2>/dev/null
