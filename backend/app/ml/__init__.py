"""
LearnOn ML Modules
==================
All ML modules share a common interface:
  - train(data: pd.DataFrame) -> model
  - predict(model, features) -> prediction
  - evaluate(model, X_test, y_test) -> metrics dict
  - save(model, path) / load(path) -> model

Each module is independently documented and testable.
NOTE: All models require sufficient real data to produce valid predictions.
      Sample data demonstrations are clearly labeled as SYNTHETIC.
"""
