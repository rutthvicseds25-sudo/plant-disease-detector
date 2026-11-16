
import React from 'react';

const questions = [
  {
    id: 'spots',
    question: 'Are there visible spots on the leaf?'
  },
  {
    id: 'yellowing',
    question: 'Is the leaf turning yellow?'
  },
  {
    id: 'wilting',
    question: 'Is the leaf drying or wilting?'
  },
  {
    id: 'spreading',
    question: 'Does the damage appear to be spreading?'
  },
  {
    id: 'leaf_affected',
    question: 'Is more than half the leaf affected?'
  },
  {
    id: 'multiple_leaves',
    question: 'Are multiple leaves affected?'
  }
];

export default function SymptomQuestionnaire({
  answers,
  onAnswerChange,
  observations,
  onObservationsChange
}) {
  return (
    <div className="questionnaire">
      <h3>🌿 Additional Plant Observations</h3>
      <p className="questionnaire-intro">
        Help us understand your plant's condition better.
        Select the option that best describes what you observe.
      </p>

      {questions.map((item, index) => (
        <div className="question-item" key={item.id}>
          <p>
            <strong>{index + 1}. {item.question}</strong>
          </p>

          <div className="answer-options">
            {['Yes', 'No', 'Unsure'].map((option) => (
              <button
                type="button"
                key={option}
                className={`answer-btn ${
                  answers[item.id] === option ? 'selected' : ''
                }`}
                aria-pressed={answers[item.id] === option}
                onClick={() => onAnswerChange(item.id, option)}
              >
                {option}
              </button>
            ))}
          </div>
        </div>
      ))}

      <div className="observations-field">
        <label htmlFor="observations">
          Any other observations? (Optional)
        </label>
        <textarea
          id="observations"
          value={observations}
          onChange={(e) => onObservationsChange(e.target.value)}
          placeholder="Describe anything unusual you noticed..."
          rows={4}
          maxLength={1000}
        />
      </div>
    </div>
  );
}
