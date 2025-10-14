const express = require('express');
const bodyParser = require('body-parser');
const latex = require('node-latex');
const fs = require('fs');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(cors());
app.use(bodyParser.json());
app.use(express.static(__dirname));

// Debug route to verify form submission works
app.post('/debug-latex', (req, res) => {
  console.log('Debug: Received form data:', req.body);
  res.json({ 
    message: 'Form data received successfully',
    data: req.body 
  });
});

app.post('/generate-pdf', (req, res) => {
  console.log('Received request body:', req.body);
  
  if (!req.body || !req.body.latexContent) {
    console.error('Missing latexContent in request body');
    return res.status(400).json({ error: 'Missing latexContent in request body' });
  }
  
  const latexContent = req.body.latexContent;
  const outputPath = path.join(__dirname, 'resume.pdf');
  const output = fs.createWriteStream(outputPath);
  
  try {
    // Check if latex is installed
    const { execSync } = require('child_process');
    let latexVersion;
    try {
      latexVersion = execSync('pdflatex --version').toString();
      console.log('LaTeX is installed:', latexVersion.split('\n')[0]);
    } catch (err) {
      console.error('LaTeX is not installed:', err.message);
      return res.status(500).json({
        error: 'LaTeX is not installed',
        details: 'Please install TeX Live or MiKTeX first',
        setupHelp: 'Visit https://www.latex-project.org/get/ for installation instructions'
      });
    }

    console.log('Starting PDF generation with content length:', latexContent.length);
    const pdf = latex(latexContent);

    pdf.pipe(output);
    pdf.on('error', (err) => {
      console.error('Error generating PDF:', err);
      // Clean up the partial output file
      if (fs.existsSync(outputPath)) {
        fs.unlinkSync(outputPath);
      }
      res.status(500).json({ 
        error: 'Error generating PDF', 
        details: err.message,
        latexError: err.message.includes('LaTeX') ? 'LaTeX compilation failed' : undefined,
        stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
      });
    });
    pdf.on('finish', () => {
      console.log('PDF generated successfully!');
      res.download(outputPath, 'resume.pdf', (err) => {
        if (err) {
          console.error('Error sending PDF:', err);
          res.status(500).json({ 
            error: 'Error sending PDF', 
            details: err.message 
          });
        } else {
          console.log('PDF sent successfully!');
          fs.unlinkSync(outputPath);
        }
      });
    });
  } catch (err) {
    console.error('Unexpected error in PDF generation:', err);
    res.status(500).json({ 
      error: 'Unexpected error in PDF generation', 
      details: err.message,
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
