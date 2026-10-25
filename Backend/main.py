import argparse
from pathlib import Path
from auditvision.dataset_runner import run

parser=argparse.ArgumentParser(description="Run the local OpenCV 5 synthetic-audit baseline.")
parser.add_argument("--pdf", type=Path, required=True); parser.add_argument("--ground-truth", type=Path, required=True); parser.add_argument("--output", type=Path, default=Path("data/output"))
args=parser.parse_args(); print(run(args.pdf,args.ground_truth,args.output))
