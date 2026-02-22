#!/bin/bash
# install.sh — install recs binary from GitHub releases
#
# Usage:
#   curl -fsSL https://raw.githubusercontent.com/benbernard/RecordStream/master/install.sh | bash
#
# Environment variables:
#   INSTALL_DIR — custom install directory (default: /usr/local/bin or ~/.local/bin)
#   VERSION     — specific version to install (default: latest)

set -euo pipefail

REPO="benbernard/RecordStream"
BINARY_NAME="recs"

# ── Detect platform ──────────────────────────────────────────────

detect_platform() {
  OS="$(uname -s | tr '[:upper:]' '[:lower:]')"
  ARCH="$(uname -m)"

  case "$OS" in
    linux)  OS="linux" ;;
    darwin) OS="darwin" ;;
    *)
      echo "Error: Unsupported operating system: $OS" >&2
      exit 1
      ;;
  esac

  case "$ARCH" in
    x86_64|amd64) ARCH="x64" ;;
    aarch64|arm64) ARCH="arm64" ;;
    *)
      echo "Error: Unsupported architecture: $ARCH" >&2
      exit 1
      ;;
  esac

  PLATFORM="${OS}-${ARCH}"
}

# ── Determine install directory ──────────────────────────────────

determine_install_dir() {
  if [ -n "${INSTALL_DIR:-}" ]; then
    TARGET_DIR="$INSTALL_DIR"
  elif [ -w /usr/local/bin ]; then
    TARGET_DIR="/usr/local/bin"
  else
    TARGET_DIR="${HOME}/.local/bin"
    mkdir -p "$TARGET_DIR"
  fi
}

# ── Download helper ──────────────────────────────────────────────

download() {
  url="$1"
  output="$2"

  if command -v curl >/dev/null 2>&1; then
    curl -fsSL -o "$output" "$url"
  elif command -v wget >/dev/null 2>&1; then
    wget -qO "$output" "$url"
  else
    echo "Error: Neither curl nor wget found. Please install one of them." >&2
    exit 1
  fi
}

# ── Fetch JSON helper ────────────────────────────────────────────

fetch_json() {
  url="$1"

  if command -v curl >/dev/null 2>&1; then
    curl -fsSL "$url"
  elif command -v wget >/dev/null 2>&1; then
    wget -qO- "$url"
  else
    echo "Error: Neither curl nor wget found." >&2
    exit 1
  fi
}

# ── Get latest version ───────────────────────────────────────────

get_latest_version() {
  if [ -n "${VERSION:-}" ]; then
    echo "$VERSION"
    return
  fi

  RELEASES_URL="https://api.github.com/repos/${REPO}/releases/latest"
  TAG=$(fetch_json "$RELEASES_URL" | grep '"tag_name"' | head -1 | sed 's/.*"tag_name"[[:space:]]*:[[:space:]]*"//' | sed 's/".*//')

  if [ -z "$TAG" ]; then
    echo "Error: Could not determine latest version." >&2
    exit 1
  fi

  echo "$TAG"
}

# ── Main ─────────────────────────────────────────────────────────

main() {
  echo "Installing recs..."

  detect_platform
  determine_install_dir

  VERSION_TAG=$(get_latest_version)
  VERSION_NUM="${VERSION_TAG#v}"

  ASSET_NAME="${BINARY_NAME}-${PLATFORM}"
  DOWNLOAD_URL="https://github.com/${REPO}/releases/download/${VERSION_TAG}/${ASSET_NAME}"

  echo "  Platform:  ${PLATFORM}"
  echo "  Version:   ${VERSION_TAG}"
  echo "  Directory: ${TARGET_DIR}"

  TMPFILE=$(mktemp)
  trap 'rm -f "$TMPFILE"' EXIT

  echo "  Downloading ${ASSET_NAME}..."
  download "$DOWNLOAD_URL" "$TMPFILE"

  chmod +x "$TMPFILE"

  # Verify the binary runs
  if ! "$TMPFILE" --version >/dev/null 2>&1; then
    echo "Error: Downloaded binary failed to run. The release may not include a binary for ${PLATFORM}." >&2
    exit 1
  fi

  # Install atomically via rename
  mv "$TMPFILE" "${TARGET_DIR}/${BINARY_NAME}"

  echo ""
  echo "  recs ${VERSION_NUM} installed to ${TARGET_DIR}/${BINARY_NAME}"
  echo ""

  # Check if install dir is in PATH
  case ":${PATH}:" in
    *":${TARGET_DIR}:"*) ;;
    *)
      echo "  Note: ${TARGET_DIR} is not in your PATH."
      echo "  Add it with:  export PATH=\"${TARGET_DIR}:\$PATH\""
      echo ""
      ;;
  esac

  echo "  Get started:  recs help"
  echo "  Examples:     recs examples"
}

main
