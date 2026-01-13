#!/bin/bash
# UI24R Mini Mixer Test Runner
# Run all tests: ./test.sh
# Run specific suite: ./test.sh unit|e2e|all

set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${YELLOW}UI24R Mini Mixer Test Runner${NC}"
echo "==============================="

case "${1:-all}" in
  client)
    echo -e "\n${GREEN}Running client unit tests...${NC}"
    cd client && npm run test:run
    ;;
  server)
    echo -e "\n${GREEN}Running server unit tests...${NC}"
    cd server && npm test
    ;;
  unit)
    echo -e "\n${GREEN}Running all unit tests...${NC}"
    echo -e "\n${YELLOW}Client tests:${NC}"
    cd client && npm run test:run
    cd ..
    echo -e "\n${YELLOW}Server tests:${NC}"
    cd server && npm test
    ;;
  watch)
    echo -e "\n${GREEN}Starting client unit test watcher...${NC}"
    cd client && npm run test
    ;;
  watch:server)
    echo -e "\n${GREEN}Starting server unit test watcher...${NC}"
    cd server && npm run test:watch
    ;;
  e2e)
    echo -e "\n${GREEN}Running E2E tests...${NC}"
    echo "Note: Will start dev server automatically"
    # Run specific test files, excluding legacy tests which need special handling
    npx playwright test tests/fader-lcd-display.spec.ts tests/mobile-layout.spec.ts tests/portrait-mode.spec.ts
    ;;
  e2e:headed)
    echo -e "\n${GREEN}Running E2E tests (headed mode)...${NC}"
    npx playwright test --headed
    ;;
  e2e:debug)
    echo -e "\n${GREEN}Running E2E tests (debug mode)...${NC}"
    npx playwright test --debug
    ;;
  e2e:ui)
    echo -e "\n${GREEN}Opening Playwright UI...${NC}"
    npx playwright test --ui
    ;;
  e2e:update)
    echo -e "\n${GREEN}Updating E2E snapshots...${NC}"
    npx playwright test tests/fader-lcd-display.spec.ts tests/mobile-layout.spec.ts tests/portrait-mode.spec.ts --update-snapshots
    ;;
  legacy)
    echo -e "\n${GREEN}Running legacy compatibility tests...${NC}"
    echo "Building production bundle..."
    npm run build
    # Use single worker to avoid race conditions with preview server
    npx playwright test tests/legacy-compatibility.spec.ts --project="Desktop Chrome" --workers=1
    ;;
  coverage)
    echo -e "\n${GREEN}Running client unit tests with coverage...${NC}"
    cd client && npm run test:coverage
    ;;
  all)
    echo -e "\n${GREEN}Running all unit tests...${NC}"
    echo -e "\n${YELLOW}Client tests:${NC}"
    cd client && npm run test:run
    cd ..
    echo -e "\n${YELLOW}Server tests:${NC}"
    cd server && npm test
    cd ..

    echo -e "\n${GREEN}Running E2E tests...${NC}"
    # Run specific test files, excluding legacy tests which need special handling
    npx playwright test tests/fader-lcd-display.spec.ts tests/mobile-layout.spec.ts tests/portrait-mode.spec.ts

    echo -e "\n${GREEN}All tests passed!${NC}"
    ;;
  install)
    echo -e "\n${GREEN}Installing test dependencies...${NC}"
    cd client && npm install -D vitest @testing-library/react @testing-library/jest-dom jsdom
    cd ..
    cd server && npm install -D vitest
    cd ..
    npx playwright install
    echo -e "\n${GREEN}Test dependencies installed!${NC}"
    ;;
  *)
    echo "Usage: ./test.sh [command]"
    echo ""
    echo "Commands:"
    echo "  client       - Run client unit tests only"
    echo "  server       - Run server unit tests only"
    echo "  unit         - Run all unit tests (client + server)"
    echo "  watch        - Start client vitest in watch mode"
    echo "  watch:server - Start server vitest in watch mode"
    echo "  e2e          - Run Playwright E2E tests"
    echo "  e2e:headed   - Run E2E tests in headed browser mode"
    echo "  e2e:debug    - Run E2E tests in debug mode"
    echo "  e2e:ui       - Open Playwright UI for interactive testing"
    echo "  e2e:update   - Update E2E test snapshots"
    echo "  legacy       - Run legacy browser compatibility tests"
    echo "  coverage     - Run client unit tests with coverage report"
    echo "  all          - Run all tests (unit + E2E) - default"
    echo "  install      - Install all test dependencies"
    exit 1
    ;;
esac
