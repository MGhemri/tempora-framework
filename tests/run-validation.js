/**
 * Portable Python Runner for Dataset Validation
 * Tries python3, python, and py to execute validate_dataset.py portably across OSes.
 */

const { spawnSync } = require('child_process');
const path = require('path');

const scriptPath = path.join(__dirname, '../validate_dataset.py');
const pythonCommands = ['python3', 'python', 'py'];

let executed = false;
let result = null;

for (const cmd of pythonCommands) {
  try {
    const probe = spawnSync(cmd, ['--version'], { stdio: 'ignore' });
    if (probe.status === 0 && !probe.error) {
      result = spawnSync(cmd, [scriptPath], { stdio: 'inherit' });
      executed = true;
      break;
    }
  } catch {
    // Continue searching for available Python binary
  }
}

if (!executed) {
  console.error('❌ Error: Python 3 executable (python3, python, or py) was not found in PATH.');
  console.error('Please install Python 3.8+ to validate the dataset.');
  process.exit(1);
}

if (result && result.status !== 0) {
  process.exit(result.status || 1);
}
