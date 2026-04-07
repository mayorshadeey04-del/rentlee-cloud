import React from 'react';

export default function SubmitButton({ 
  isSubmitting, 
  text = 'Submit', 
  loadingText = 'Saving...', 
  className = 'btn btn-primary', // Default class, but you can override it
  ...props // This catches anything else you pass to the button, like onClick or type
}) {
  return (
    <button 
      className={className} 
      disabled={isSubmitting}
      {...props}
    >
      {isSubmitting ? (
        <>
          <i className="fas fa-spinner fa-spin" style={{ marginRight: '8px' }}></i>
          {loadingText}
        </>
      ) : (
        text
      )}
    </button>
  );
}