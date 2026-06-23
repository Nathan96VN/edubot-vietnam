// seed-math.js
// Cambridge Primary Mathematics 0096 Curriculum Framework
// Stages 1–6 — all learning objectives
// Run once: change Render build command to `npm install && node seed-math.js`, deploy, then revert.

const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

const objectives = [
  // ─────────────────────────────────────────────
  // STAGE 1
  // ─────────────────────────────────────────────

  // Thinking and Working Mathematically (Stage 1)
  { stage: 1, strand: 'Thinking and Working Mathematically', substrand: 'TWM', code: 'TWM.01', objective: 'Specialising: Choosing an example and checking to see if it satisfies or does not satisfy specific mathematical criteria.' },
  { stage: 1, strand: 'Thinking and Working Mathematically', substrand: 'TWM', code: 'TWM.02', objective: 'Generalising: Recognising an underlying pattern by identifying many examples that satisfy the same mathematical criteria.' },
  { stage: 1, strand: 'Thinking and Working Mathematically', substrand: 'TWM', code: 'TWM.03', objective: 'Conjecturing: Forming mathematical questions or ideas.' },
  { stage: 1, strand: 'Thinking and Working Mathematically', substrand: 'TWM', code: 'TWM.04', objective: 'Convincing: Presenting evidence to justify or challenge a mathematical idea or solution.' },
  { stage: 1, strand: 'Thinking and Working Mathematically', substrand: 'TWM', code: 'TWM.05', objective: 'Characterising: Identifying and describing the mathematical properties of an object.' },
  { stage: 1, strand: 'Thinking and Working Mathematically', substrand: 'TWM', code: 'TWM.06', objective: 'Classifying: Organising objects into groups according to their mathematical properties.' },
  { stage: 1, strand: 'Thinking and Working Mathematically', substrand: 'TWM', code: 'TWM.07', objective: 'Critiquing: Comparing and evaluating mathematical ideas, representations or solutions to identify advantages and disadvantages.' },
  { stage: 1, strand: 'Thinking and Working Mathematically', substrand: 'TWM', code: 'TWM.08', objective: 'Improving: Refining mathematical ideas or representations to develop a more effective approach or solution.' },

  // Number — Counting and sequences (Stage 1)
  { stage: 1, strand: 'Number', substrand: 'Counting and sequences', code: '1Nc.01', objective: 'Count objects from 0 to 20, recognising conservation of number and one-to-one correspondence.' },
  { stage: 1, strand: 'Number', substrand: 'Counting and sequences', code: '1Nc.02', objective: 'Recognise the number of objects presented in familiar patterns up to 10, without counting.' },
  { stage: 1, strand: 'Number', substrand: 'Counting and sequences', code: '1Nc.03', objective: 'Estimate the number of objects or people (up to 20), and check by counting.' },
  { stage: 1, strand: 'Number', substrand: 'Counting and sequences', code: '1Nc.04', objective: 'Count on in ones, twos or tens, and count back in ones and tens, starting from any number (from 0 to 20).' },
  { stage: 1, strand: 'Number', substrand: 'Counting and sequences', code: '1Nc.05', objective: 'Understand even and odd numbers as "every other number" when counting (from 0 to 20).' },
  { stage: 1, strand: 'Number', substrand: 'Counting and sequences', code: '1Nc.06', objective: 'Use familiar language to describe sequences of objects.' },

  // Number — Integers and powers (Stage 1)
  { stage: 1, strand: 'Number', substrand: 'Integers and powers', code: '1Ni.01', objective: 'Recite, read and write number names and whole numbers (from 0 to 20).' },
  { stage: 1, strand: 'Number', substrand: 'Integers and powers', code: '1Ni.02', objective: 'Understand addition as: counting on; combining two sets.' },
  { stage: 1, strand: 'Number', substrand: 'Integers and powers', code: '1Ni.03', objective: 'Understand subtraction as: counting back; take away; difference.' },
  { stage: 1, strand: 'Number', substrand: 'Integers and powers', code: '1Ni.04', objective: 'Recognise complements of 10.' },
  { stage: 1, strand: 'Number', substrand: 'Integers and powers', code: '1Ni.05', objective: 'Estimate, add and subtract whole numbers (where the answer is from 0 to 20).' },
  { stage: 1, strand: 'Number', substrand: 'Integers and powers', code: '1Ni.06', objective: 'Know doubles up to double 10.' },

  // Number — Money (Stage 1)
  { stage: 1, strand: 'Number', substrand: 'Money', code: '1Nm.01', objective: 'Recognise money used in local currency.' },

  // Number — Place value, ordering and rounding (Stage 1)
  { stage: 1, strand: 'Number', substrand: 'Place value, ordering and rounding', code: '1Np.01', objective: 'Understand that zero represents none of something.' },
  { stage: 1, strand: 'Number', substrand: 'Place value, ordering and rounding', code: '1Np.02', objective: 'Compose, decompose and regroup numbers from 10 to 20.' },
  { stage: 1, strand: 'Number', substrand: 'Place value, ordering and rounding', code: '1Np.03', objective: 'Understand the relative size of quantities to compare and order numbers from 0 to 20.' },
  { stage: 1, strand: 'Number', substrand: 'Place value, ordering and rounding', code: '1Np.04', objective: 'Recognise and use ordinal numbers from 1st to 10th.' },

  // Number — Fractions, decimals, percentages, ratio and proportion (Stage 1)
  { stage: 1, strand: 'Number', substrand: 'Fractions, decimals, percentages, ratio and proportion', code: '1Nf.01', objective: 'Understand that an object or shape can be split into two equal parts or two unequal parts.' },
  { stage: 1, strand: 'Number', substrand: 'Fractions, decimals, percentages, ratio and proportion', code: '1Nf.02', objective: 'Understand that a half can describe one of two equal parts of a quantity or set of objects.' },
  { stage: 1, strand: 'Number', substrand: 'Fractions, decimals, percentages, ratio and proportion', code: '1Nf.03', objective: 'Understand that a half can act as an operator (whole number answers).' },
  { stage: 1, strand: 'Number', substrand: 'Fractions, decimals, percentages, ratio and proportion', code: '1Nf.04', objective: 'Understand and visualise that halves can be combined to make wholes.' },

  // Geometry and Measure — Time (Stage 1)
  { stage: 1, strand: 'Geometry and Measure', substrand: 'Time', code: '1Gt.01', objective: 'Use familiar language to describe units of time.' },
  { stage: 1, strand: 'Geometry and Measure', substrand: 'Time', code: '1Gt.02', objective: 'Know the days of the week and the months of the year.' },
  { stage: 1, strand: 'Geometry and Measure', substrand: 'Time', code: '1Gt.03', objective: 'Recognise time to the hour and half hour.' },

  // Geometry and Measure — Geometrical reasoning, shapes and measurements (Stage 1)
  { stage: 1, strand: 'Geometry and Measure', substrand: 'Geometrical reasoning, shapes and measurements', code: '1Gg.01', objective: 'Identify, describe and sort 2D shapes by their characteristics or properties, including reference to number of sides and whether the sides are curved or straight.' },
  { stage: 1, strand: 'Geometry and Measure', substrand: 'Geometrical reasoning, shapes and measurements', code: '1Gg.02', objective: 'Use familiar language to describe length, including long, longer, longest, thin, thinner, thinnest, short, shorter, shortest, tall, taller and tallest.' },
  { stage: 1, strand: 'Geometry and Measure', substrand: 'Geometrical reasoning, shapes and measurements', code: '1Gg.03', objective: 'Identify, describe and sort 3D shapes by their properties, including reference to the number of faces, edges and whether faces are flat or curved.' },
  { stage: 1, strand: 'Geometry and Measure', substrand: 'Geometrical reasoning, shapes and measurements', code: '1Gg.04', objective: 'Use familiar language to describe mass, including heavy, light, less and more.' },
  { stage: 1, strand: 'Geometry and Measure', substrand: 'Geometrical reasoning, shapes and measurements', code: '1Gg.05', objective: 'Use familiar language to describe capacity, including full, empty, less and more.' },
  { stage: 1, strand: 'Geometry and Measure', substrand: 'Geometrical reasoning, shapes and measurements', code: '1Gg.06', objective: 'Differentiate between 2D and 3D shapes.' },
  { stage: 1, strand: 'Geometry and Measure', substrand: 'Geometrical reasoning, shapes and measurements', code: '1Gg.07', objective: 'Identify when a shape looks identical as it rotates.' },
  { stage: 1, strand: 'Geometry and Measure', substrand: 'Geometrical reasoning, shapes and measurements', code: '1Gg.08', objective: 'Explore instruments that have numbered scales, and select the most appropriate instrument to measure length, mass, capacity and temperature.' },

  // Geometry and Measure — Position and transformation (Stage 1)
  { stage: 1, strand: 'Geometry and Measure', substrand: 'Position and transformation', code: '1Gp.01', objective: 'Use familiar language to describe position and direction.' },

  // Statistics and Probability — Statistics (Stage 1)
  { stage: 1, strand: 'Statistics and Probability', substrand: 'Statistics', code: '1Ss.01', objective: 'Answer non-statistical questions (categorical data).' },
  { stage: 1, strand: 'Statistics and Probability', substrand: 'Statistics', code: '1Ss.02', objective: 'Record, organise and represent categorical data using: practical resources and drawings; lists and tables; Venn and Carroll diagrams; block graphs and pictograms.' },
  { stage: 1, strand: 'Statistics and Probability', substrand: 'Statistics', code: '1Ss.03', objective: 'Describe data, using familiar language including reference to more, less, most or least to answer non-statistical questions and discuss conclusions.' },

  // ─────────────────────────────────────────────
  // STAGE 2
  // ─────────────────────────────────────────────

  // Number — Counting and sequences (Stage 2)
  { stage: 2, strand: 'Number', substrand: 'Counting and sequences', code: '2Nc.01', objective: 'Count objects from 0 to 100.' },
  { stage: 2, strand: 'Number', substrand: 'Counting and sequences', code: '2Nc.02', objective: 'Recognise the number of objects presented in unfamiliar patterns up to 10, without counting.' },
  { stage: 2, strand: 'Number', substrand: 'Counting and sequences', code: '2Nc.03', objective: 'Estimate the number of objects or people (up to 100).' },
  { stage: 2, strand: 'Number', substrand: 'Counting and sequences', code: '2Nc.04', objective: 'Count on and count back in ones, twos, fives or tens, starting from any number (from 0 to 100).' },
  { stage: 2, strand: 'Number', substrand: 'Counting and sequences', code: '2Nc.05', objective: 'Recognise the characteristics of even and odd numbers (from 0 to 100).' },
  { stage: 2, strand: 'Number', substrand: 'Counting and sequences', code: '2Nc.06', objective: 'Recognise, describe and extend numerical sequences (from 0 to 100).' },

  // Number — Integers and powers (Stage 2)
  { stage: 2, strand: 'Number', substrand: 'Integers and powers', code: '2Ni.01', objective: 'Recite, read and write number names and whole numbers (from 0 to 100).' },
  { stage: 2, strand: 'Number', substrand: 'Integers and powers', code: '2Ni.02', objective: 'Understand and explain the relationship between addition and subtraction.' },
  { stage: 2, strand: 'Number', substrand: 'Integers and powers', code: '2Ni.03', objective: 'Recognise complements of 20 and complements of multiples of 10 (up to 100).' },
  { stage: 2, strand: 'Number', substrand: 'Integers and powers', code: '2Ni.04', objective: 'Estimate, add and subtract whole numbers with up to two digits (no regrouping of ones or tens).' },
  { stage: 2, strand: 'Number', substrand: 'Integers and powers', code: '2Ni.05', objective: 'Understand multiplication as: repeated addition; an array.' },
  { stage: 2, strand: 'Number', substrand: 'Integers and powers', code: '2Ni.06', objective: 'Understand division as: sharing (number of items per group); grouping (number of groups).' },
  { stage: 2, strand: 'Number', substrand: 'Integers and powers', code: '2Ni.07', objective: 'Know 1, 2, 5 and 10 times tables.' },

  // Number — Money (Stage 2)
  { stage: 2, strand: 'Number', substrand: 'Money', code: '2Nm.01', objective: 'Recognise value and money notation used in local currency.' },
  { stage: 2, strand: 'Number', substrand: 'Money', code: '2Nm.02', objective: 'Compare values of different combinations of coins or notes.' },

  // Number — Place value, ordering and rounding (Stage 2)
  { stage: 2, strand: 'Number', substrand: 'Place value, ordering and rounding', code: '2Np.01', objective: 'Understand and explain that the value of each digit in a 2-digit number is determined by its position in that number, recognising zero as a place holder.' },
  { stage: 2, strand: 'Number', substrand: 'Place value, ordering and rounding', code: '2Np.02', objective: 'Compose, decompose and regroup 2-digit numbers, using tens and ones.' },
  { stage: 2, strand: 'Number', substrand: 'Place value, ordering and rounding', code: '2Np.03', objective: 'Understand the relative size of quantities to compare and order 2-digit numbers.' },
  { stage: 2, strand: 'Number', substrand: 'Place value, ordering and rounding', code: '2Np.04', objective: 'Recognise and use ordinal numbers.' },
  { stage: 2, strand: 'Number', substrand: 'Place value, ordering and rounding', code: '2Np.05', objective: 'Round 2-digit numbers to the nearest 10.' },

  // Number — Fractions, decimals, percentages, ratio and proportion (Stage 2)
  { stage: 2, strand: 'Number', substrand: 'Fractions, decimals, percentages, ratio and proportion', code: '2Nf.01', objective: 'Understand that an object or shape can be split into four equal parts or four unequal parts.' },
  { stage: 2, strand: 'Number', substrand: 'Fractions, decimals, percentages, ratio and proportion', code: '2Nf.02', objective: 'Understand that a quarter can describe one of four equal parts of a quantity or set of objects.' },
  { stage: 2, strand: 'Number', substrand: 'Fractions, decimals, percentages, ratio and proportion', code: '2Nf.03', objective: 'Understand that one half and one quarter can be interpreted as division.' },
  { stage: 2, strand: 'Number', substrand: 'Fractions, decimals, percentages, ratio and proportion', code: '2Nf.04', objective: 'Understand that fractions (half, quarter and three-quarters) can act as operators.' },
  { stage: 2, strand: 'Number', substrand: 'Fractions, decimals, percentages, ratio and proportion', code: '2Nf.05', objective: 'Recognise the relative size of 1/4, 1/2, 3/4 and 1, and the equivalence of 1/2 and 2/4, and 2/2, 4/4 and 1.' },
  { stage: 2, strand: 'Number', substrand: 'Fractions, decimals, percentages, ratio and proportion', code: '2Nf.06', objective: 'Understand and visualise that wholes, halves and quarters can be combined to create new fractions.' },

  // Geometry and Measure — Time (Stage 2)
  { stage: 2, strand: 'Geometry and Measure', substrand: 'Time', code: '2Gt.01', objective: 'Order and compare units of time (seconds, minutes, hours, days, weeks, months and years).' },
  { stage: 2, strand: 'Geometry and Measure', substrand: 'Time', code: '2Gt.02', objective: 'Read and record time to five minutes in digital notation (12-hour) and on analogue clocks.' },
  { stage: 2, strand: 'Geometry and Measure', substrand: 'Time', code: '2Gt.03', objective: 'Interpret and use the information in calendars.' },

  // Geometry and Measure — Geometrical reasoning, shapes and measurements (Stage 2)
  { stage: 2, strand: 'Geometry and Measure', substrand: 'Geometrical reasoning, shapes and measurements', code: '2Gg.01', objective: 'Identify, describe, sort, name and sketch 2D shapes by their properties, including reference to regular polygons, number of sides and vertices. Recognise these shapes in different positions and orientations.' },
  { stage: 2, strand: 'Geometry and Measure', substrand: 'Geometrical reasoning, shapes and measurements', code: '2Gg.02', objective: 'Understand that a circle has a centre and any point on the boundary is at the same distance from the centre.' },
  { stage: 2, strand: 'Geometry and Measure', substrand: 'Geometrical reasoning, shapes and measurements', code: '2Gg.03', objective: 'Understand that length is a fixed distance between two points. Estimate and measure lengths using non-standard or standard units.' },
  { stage: 2, strand: 'Geometry and Measure', substrand: 'Geometrical reasoning, shapes and measurements', code: '2Gg.04', objective: 'Draw and measure lines, using standard units.' },
  { stage: 2, strand: 'Geometry and Measure', substrand: 'Geometrical reasoning, shapes and measurements', code: '2Gg.05', objective: 'Identify, describe, sort and name 3D shapes by their properties, including reference to number and shapes of faces, edges and vertices.' },
  { stage: 2, strand: 'Geometry and Measure', substrand: 'Geometrical reasoning, shapes and measurements', code: '2Gg.06', objective: 'Understand that mass is the quantity of matter in an object. Estimate and measure familiar objects using non-standard or standard units.' },
  { stage: 2, strand: 'Geometry and Measure', substrand: 'Geometrical reasoning, shapes and measurements', code: '2Gg.07', objective: 'Understand that capacity is the maximum amount that an object can contain. Estimate and measure the capacity of familiar objects using non-standard or standard units.' },
  { stage: 2, strand: 'Geometry and Measure', substrand: 'Geometrical reasoning, shapes and measurements', code: '2Gg.08', objective: 'Identify 2D and 3D shapes in familiar objects.' },
  { stage: 2, strand: 'Geometry and Measure', substrand: 'Geometrical reasoning, shapes and measurements', code: '2Gg.09', objective: 'Identify a horizontal or vertical line of symmetry on 2D shapes and patterns.' },
  { stage: 2, strand: 'Geometry and Measure', substrand: 'Geometrical reasoning, shapes and measurements', code: '2Gg.10', objective: 'Predict and check how many times a shape looks identical as it completes a full turn.' },
  { stage: 2, strand: 'Geometry and Measure', substrand: 'Geometrical reasoning, shapes and measurements', code: '2Gg.11', objective: 'Understand that an angle is a description of a turn, including reference to the terms whole, half and quarter turns, both clockwise and anticlockwise.' },
  { stage: 2, strand: 'Geometry and Measure', substrand: 'Geometrical reasoning, shapes and measurements', code: '2Gg.12', objective: 'Understand a measuring scale as a continuous number line where intermediate points have value.' },

  // Geometry and Measure — Position and transformation (Stage 2)
  { stage: 2, strand: 'Geometry and Measure', substrand: 'Position and transformation', code: '2Gp.01', objective: 'Use knowledge of position and direction to describe movement.' },
  { stage: 2, strand: 'Geometry and Measure', substrand: 'Position and transformation', code: '2Gp.02', objective: 'Sketch the reflection of a 2D shape in a vertical mirror line, including where the mirror line is the edge of the shape.' },

  // Statistics and Probability — Statistics (Stage 2)
  { stage: 2, strand: 'Statistics and Probability', substrand: 'Statistics', code: '2Ss.01', objective: 'Conduct an investigation to answer non-statistical and statistical questions (categorical data).' },
  { stage: 2, strand: 'Statistics and Probability', substrand: 'Statistics', code: '2Ss.02', objective: 'Record, organise and represent categorical data. Choose and explain which representation to use in a given situation: lists and tables; Venn and Carroll diagrams; tally charts; block graphs and pictograms.' },
  { stage: 2, strand: 'Statistics and Probability', substrand: 'Statistics', code: '2Ss.03', objective: 'Describe data, identifying similarities and variations to answer non-statistical and statistical questions and discuss conclusions.' },

  // Statistics and Probability — Probability (Stage 2)
  { stage: 2, strand: 'Statistics and Probability', substrand: 'Probability', code: '2Sp.01', objective: 'Use familiar language associated with patterns and randomness, including regular pattern and random pattern.' },
  { stage: 2, strand: 'Statistics and Probability', substrand: 'Probability', code: '2Sp.02', objective: 'Conduct chance experiments with two outcomes, and present and describe the results.' },

  // ─────────────────────────────────────────────
  // STAGE 3
  // ─────────────────────────────────────────────

  // Number — Counting and sequences (Stage 3)
  { stage: 3, strand: 'Number', substrand: 'Counting and sequences', code: '3Nc.01', objective: 'Estimate the number of objects or people (up to 1000).' },
  { stage: 3, strand: 'Number', substrand: 'Counting and sequences', code: '3Nc.02', objective: 'Count on and count back in steps of constant size: 1-digit numbers, tens or hundreds, starting from any number (from 0 to 1000).' },
  { stage: 3, strand: 'Number', substrand: 'Counting and sequences', code: '3Nc.03', objective: 'Use knowledge of even and odd numbers up to 10 to recognise and sort numbers.' },
  { stage: 3, strand: 'Number', substrand: 'Counting and sequences', code: '3Nc.04', objective: 'Recognise the use of an object to represent an unknown quantity in addition and subtraction calculations.' },
  { stage: 3, strand: 'Number', substrand: 'Counting and sequences', code: '3Nc.05', objective: 'Recognise and extend linear sequences, and describe the term-to-term rule.' },
  { stage: 3, strand: 'Number', substrand: 'Counting and sequences', code: '3Nc.06', objective: 'Extend spatial patterns formed from adding and subtracting a constant.' },

  // Number — Integers and powers (Stage 3)
  { stage: 3, strand: 'Number', substrand: 'Integers and powers', code: '3Ni.01', objective: 'Recite, read and write number names and whole numbers (from 0 to 1000).' },
  { stage: 3, strand: 'Number', substrand: 'Integers and powers', code: '3Ni.02', objective: 'Understand the commutative and associative properties of addition, and use these to simplify calculations.' },
  { stage: 3, strand: 'Number', substrand: 'Integers and powers', code: '3Ni.03', objective: 'Recognise complements of 100 and complements of multiples of 10 or 100 (up to 1000).' },
  { stage: 3, strand: 'Number', substrand: 'Integers and powers', code: '3Ni.04', objective: 'Estimate, add and subtract whole numbers with up to three digits (regrouping of ones or tens).' },
  { stage: 3, strand: 'Number', substrand: 'Integers and powers', code: '3Ni.05', objective: 'Understand and explain the relationship between multiplication and division.' },
  { stage: 3, strand: 'Number', substrand: 'Integers and powers', code: '3Ni.06', objective: 'Understand and explain the commutative and distributive properties of multiplication, and use these to simplify calculations.' },
  { stage: 3, strand: 'Number', substrand: 'Integers and powers', code: '3Ni.07', objective: 'Know 1, 2, 3, 4, 5, 6, 8, 9 and 10 times tables.' },
  { stage: 3, strand: 'Number', substrand: 'Integers and powers', code: '3Ni.08', objective: 'Estimate and multiply whole numbers up to 100 by 2, 3, 4 and 5.' },
  { stage: 3, strand: 'Number', substrand: 'Integers and powers', code: '3Ni.09', objective: 'Estimate and divide whole numbers up to 100 by 2, 3, 4 and 5.' },
  { stage: 3, strand: 'Number', substrand: 'Integers and powers', code: '3Ni.10', objective: 'Recognise multiples of 2, 5 and 10 (up to 1000).' },

  // Number — Money (Stage 3)
  { stage: 3, strand: 'Number', substrand: 'Money', code: '3Nm.01', objective: 'Interpret money notation for currencies that use a decimal point.' },
  { stage: 3, strand: 'Number', substrand: 'Money', code: '3Nm.02', objective: 'Add and subtract amounts of money to give change.' },

  // Number — Place value, ordering and rounding (Stage 3)
  { stage: 3, strand: 'Number', substrand: 'Place value, ordering and rounding', code: '3Np.01', objective: 'Understand and explain that the value of each digit is determined by its position in that number (up to 3-digit numbers).' },
  { stage: 3, strand: 'Number', substrand: 'Place value, ordering and rounding', code: '3Np.02', objective: 'Use knowledge of place value to multiply whole numbers by 10.' },
  { stage: 3, strand: 'Number', substrand: 'Place value, ordering and rounding', code: '3Np.03', objective: 'Compose, decompose and regroup 3-digit numbers, using hundreds, tens and ones.' },
  { stage: 3, strand: 'Number', substrand: 'Place value, ordering and rounding', code: '3Np.04', objective: 'Understand the relative size of quantities to compare and order 3-digit positive numbers, using the symbols =, > and <.' },
  { stage: 3, strand: 'Number', substrand: 'Place value, ordering and rounding', code: '3Np.05', objective: 'Round 3-digit numbers to the nearest 10 or 100.' },

  // Number — Fractions, decimals, percentages, ratio and proportion (Stage 3)
  { stage: 3, strand: 'Number', substrand: 'Fractions, decimals, percentages, ratio and proportion', code: '3Nf.01', objective: 'Understand and explain that fractions are several equal parts of an object or shape and all the parts, taken together, equal one whole.' },
  { stage: 3, strand: 'Number', substrand: 'Fractions, decimals, percentages, ratio and proportion', code: '3Nf.02', objective: 'Understand that the relationship between the whole and the parts depends on the relative size of each, regardless of their shape or orientation.' },
  { stage: 3, strand: 'Number', substrand: 'Fractions, decimals, percentages, ratio and proportion', code: '3Nf.03', objective: 'Understand and explain that fractions can describe equal parts of a quantity or set of objects.' },
  { stage: 3, strand: 'Number', substrand: 'Fractions, decimals, percentages, ratio and proportion', code: '3Nf.04', objective: 'Understand that a fraction can be represented as a division of the numerator by the denominator (half, quarter and three-quarters).' },
  { stage: 3, strand: 'Number', substrand: 'Fractions, decimals, percentages, ratio and proportion', code: '3Nf.05', objective: 'Understand that fractions (half, quarter, three-quarters, third and tenth) can act as operators.' },
  { stage: 3, strand: 'Number', substrand: 'Fractions, decimals, percentages, ratio and proportion', code: '3Nf.06', objective: 'Recognise that two fractions can have an equivalent value (halves, quarters, fifths and tenths).' },
  { stage: 3, strand: 'Number', substrand: 'Fractions, decimals, percentages, ratio and proportion', code: '3Nf.07', objective: 'Estimate, add and subtract fractions with the same denominator (within one whole).' },
  { stage: 3, strand: 'Number', substrand: 'Fractions, decimals, percentages, ratio and proportion', code: '3Nf.08', objective: 'Use knowledge of equivalence to compare and order unit fractions and fractions with the same denominator, using the symbols =, > and <.' },

  // Geometry and Measure — Time (Stage 3)
  { stage: 3, strand: 'Geometry and Measure', substrand: 'Time', code: '3Gt.01', objective: 'Choose the appropriate unit of time for familiar activities.' },
  { stage: 3, strand: 'Geometry and Measure', substrand: 'Time', code: '3Gt.02', objective: 'Read and record time accurately in digital notation (12-hour) and on analogue clocks.' },
  { stage: 3, strand: 'Geometry and Measure', substrand: 'Time', code: '3Gt.03', objective: 'Interpret and use the information in timetables (12-hour clock).' },
  { stage: 3, strand: 'Geometry and Measure', substrand: 'Time', code: '3Gt.04', objective: 'Understand the difference between a time and a time interval. Find time intervals between the same units in days, weeks, months and years.' },

  // Geometry and Measure — Geometrical reasoning, shapes and measurements (Stage 3)
  { stage: 3, strand: 'Geometry and Measure', substrand: 'Geometrical reasoning, shapes and measurements', code: '3Gg.01', objective: 'Identify, describe, classify, name and sketch 2D shapes by their properties. Differentiate between regular and irregular polygons.' },
  { stage: 3, strand: 'Geometry and Measure', substrand: 'Geometrical reasoning, shapes and measurements', code: '3Gg.02', objective: 'Estimate and measure lengths in centimetres (cm), metres (m) and kilometres (km). Understand the relationship between units.' },
  { stage: 3, strand: 'Geometry and Measure', substrand: 'Geometrical reasoning, shapes and measurements', code: '3Gg.03', objective: 'Understand that perimeter is the total distance around a 2D shape and can be calculated by adding lengths, and area is how much space a 2D shape occupies within its boundary.' },
  { stage: 3, strand: 'Geometry and Measure', substrand: 'Geometrical reasoning, shapes and measurements', code: '3Gg.04', objective: 'Draw lines, rectangles and squares. Estimate, measure and calculate the perimeter of a shape, using appropriate metric units, and area on a square grid.' },
  { stage: 3, strand: 'Geometry and Measure', substrand: 'Geometrical reasoning, shapes and measurements', code: '3Gg.05', objective: 'Identify, describe, sort, name and sketch 3D shapes by their properties.' },
  { stage: 3, strand: 'Geometry and Measure', substrand: 'Geometrical reasoning, shapes and measurements', code: '3Gg.06', objective: 'Estimate and measure the mass of objects in grams (g) and kilograms (kg). Understand the relationship between units.' },
  { stage: 3, strand: 'Geometry and Measure', substrand: 'Geometrical reasoning, shapes and measurements', code: '3Gg.07', objective: 'Estimate and measure capacity in millilitres (ml) and litres (l), and understand their relationships.' },
  { stage: 3, strand: 'Geometry and Measure', substrand: 'Geometrical reasoning, shapes and measurements', code: '3Gg.08', objective: 'Recognise pictures, drawings and diagrams of 3D shapes.' },
  { stage: 3, strand: 'Geometry and Measure', substrand: 'Geometrical reasoning, shapes and measurements', code: '3Gg.09', objective: 'Identify both horizontal and vertical lines of symmetry on 2D shapes and patterns.' },
  { stage: 3, strand: 'Geometry and Measure', substrand: 'Geometrical reasoning, shapes and measurements', code: '3Gg.10', objective: 'Compare angles with a right angle. Recognise that a straight line is equivalent to two right angles or a half turn.' },
  { stage: 3, strand: 'Geometry and Measure', substrand: 'Geometrical reasoning, shapes and measurements', code: '3Gg.11', objective: 'Use instruments that measure length, mass, capacity and temperature.' },

  // Geometry and Measure — Position and transformation (Stage 3)
  { stage: 3, strand: 'Geometry and Measure', substrand: 'Position and transformation', code: '3Gp.01', objective: 'Interpret and create descriptions of position, direction and movement, including reference to cardinal points.' },
  { stage: 3, strand: 'Geometry and Measure', substrand: 'Position and transformation', code: '3Gp.02', objective: 'Sketch the reflection of a 2D shape in a horizontal or vertical mirror line, including where the mirror line is the edge of the shape.' },

  // Statistics and Probability — Statistics (Stage 3)
  { stage: 3, strand: 'Statistics and Probability', substrand: 'Statistics', code: '3Ss.01', objective: 'Conduct an investigation to answer non-statistical and statistical questions (categorical and discrete data).' },
  { stage: 3, strand: 'Statistics and Probability', substrand: 'Statistics', code: '3Ss.02', objective: 'Record, organise and represent categorical and discrete data. Choose and explain which representation to use in a given situation: Venn and Carroll diagrams; tally charts and frequency tables; pictograms and bar charts.' },
  { stage: 3, strand: 'Statistics and Probability', substrand: 'Statistics', code: '3Ss.03', objective: 'Interpret data, identifying similarities and variations, within data sets, to answer non-statistical and statistical questions and discuss conclusions.' },

  // Statistics and Probability — Probability (Stage 3)
  { stage: 3, strand: 'Statistics and Probability', substrand: 'Probability', code: '3Sp.01', objective: 'Use familiar language associated with chance to describe events, including "it will happen", "it will not happen", "it might happen".' },
  { stage: 3, strand: 'Statistics and Probability', substrand: 'Probability', code: '3Sp.02', objective: 'Conduct chance experiments, and present and describe the results.' },

  // ─────────────────────────────────────────────
  // STAGE 4
  // ─────────────────────────────────────────────

  // Number — Counting and sequences (Stage 4)
  { stage: 4, strand: 'Number', substrand: 'Counting and sequences', code: '4Nc.01', objective: 'Count on and count back in steps of constant size: 1-digit numbers, tens, hundreds or thousands, starting from any number, and extending beyond zero to include negative numbers.' },
  { stage: 4, strand: 'Number', substrand: 'Counting and sequences', code: '4Nc.02', objective: 'Recognise and explain generalisations when adding and subtracting combinations of even and odd numbers.' },
  { stage: 4, strand: 'Number', substrand: 'Counting and sequences', code: '4Nc.03', objective: 'Recognise the use of objects, shapes or symbols to represent unknown quantities in addition and subtraction calculations.' },
  { stage: 4, strand: 'Number', substrand: 'Counting and sequences', code: '4Nc.04', objective: 'Recognise and extend linear and non-linear sequences, and describe the term-to-term rule.' },
  { stage: 4, strand: 'Number', substrand: 'Counting and sequences', code: '4Nc.05', objective: 'Recognise and extend the spatial pattern of square numbers.' },

  // Number — Integers and powers (Stage 4)
  { stage: 4, strand: 'Number', substrand: 'Integers and powers', code: '4Ni.01', objective: 'Read and write number names and whole numbers greater than 1000 and less than 0.' },
  { stage: 4, strand: 'Number', substrand: 'Integers and powers', code: '4Ni.02', objective: 'Estimate, add and subtract whole numbers with up to three digits.' },
  { stage: 4, strand: 'Number', substrand: 'Integers and powers', code: '4Ni.03', objective: 'Understand the associative property of multiplication, and use this to simplify calculations.' },
  { stage: 4, strand: 'Number', substrand: 'Integers and powers', code: '4Ni.04', objective: 'Know all times tables from 1 to 10.' },
  { stage: 4, strand: 'Number', substrand: 'Integers and powers', code: '4Ni.05', objective: 'Estimate and multiply whole numbers up to 1000 by 1-digit whole numbers.' },
  { stage: 4, strand: 'Number', substrand: 'Integers and powers', code: '4Ni.06', objective: 'Estimate and divide whole numbers up to 100 by 1-digit whole numbers.' },
  { stage: 4, strand: 'Number', substrand: 'Integers and powers', code: '4Ni.07', objective: 'Understand the relationship between multiples and factors.' },
  { stage: 4, strand: 'Number', substrand: 'Integers and powers', code: '4Ni.08', objective: 'Use knowledge of factors and multiples to understand tests of divisibility by 2, 5, 10, 25, 50 and 100.' },

  // Number — Place value, ordering and rounding (Stage 4)
  { stage: 4, strand: 'Number', substrand: 'Place value, ordering and rounding', code: '4Np.01', objective: 'Understand and explain that the value of each digit in numbers is determined by its position in that number.' },
  { stage: 4, strand: 'Number', substrand: 'Place value, ordering and rounding', code: '4Np.02', objective: 'Use knowledge of place value to multiply and divide whole numbers by 10 and 100.' },
  { stage: 4, strand: 'Number', substrand: 'Place value, ordering and rounding', code: '4Np.03', objective: 'Compose, decompose and regroup whole numbers.' },
  { stage: 4, strand: 'Number', substrand: 'Place value, ordering and rounding', code: '4Np.04', objective: 'Understand the relative size of quantities to compare and order positive and negative numbers, using the symbols =, > and <.' },
  { stage: 4, strand: 'Number', substrand: 'Place value, ordering and rounding', code: '4Np.05', objective: 'Round numbers to the nearest 10, 100, 1000, 10 000 or 100 000.' },

  // Number — Fractions, decimals, percentages, ratio and proportion (Stage 4)
  { stage: 4, strand: 'Number', substrand: 'Fractions, decimals, percentages, ratio and proportion', code: '4Nf.01', objective: 'Understand that the more parts a whole is divided into, the smaller the parts become.' },
  { stage: 4, strand: 'Number', substrand: 'Fractions, decimals, percentages, ratio and proportion', code: '4Nf.02', objective: 'Understand that a fraction can be represented as a division of the numerator by the denominator (unit fractions and three-quarters).' },
  { stage: 4, strand: 'Number', substrand: 'Fractions, decimals, percentages, ratio and proportion', code: '4Nf.03', objective: 'Understand that unit fractions can act as operators.' },
  { stage: 4, strand: 'Number', substrand: 'Fractions, decimals, percentages, ratio and proportion', code: '4Nf.04', objective: 'Recognise that two proper fractions can have an equivalent value.' },
  { stage: 4, strand: 'Number', substrand: 'Fractions, decimals, percentages, ratio and proportion', code: '4Nf.05', objective: 'Estimate, add and subtract fractions with the same denominator.' },
  { stage: 4, strand: 'Number', substrand: 'Fractions, decimals, percentages, ratio and proportion', code: '4Nf.06', objective: 'Understand percentage as the number of parts in each hundred, and use the percentage symbol (%).' },
  { stage: 4, strand: 'Number', substrand: 'Fractions, decimals, percentages, ratio and proportion', code: '4Nf.07', objective: 'Use knowledge of equivalence to compare and order proper fractions, using the symbols =, > and <.' },

  // Geometry and Measure — Time (Stage 4)
  { stage: 4, strand: 'Geometry and Measure', substrand: 'Time', code: '4Gt.01', objective: 'Understand the direct relationship between units of time, and convert between them.' },
  { stage: 4, strand: 'Geometry and Measure', substrand: 'Time', code: '4Gt.02', objective: 'Read and record time accurately in digital notation (12- and 24-hour) and on analogue clocks.' },
  { stage: 4, strand: 'Geometry and Measure', substrand: 'Time', code: '4Gt.03', objective: 'Interpret and use the information in timetables (12- and 24-hour clock).' },
  { stage: 4, strand: 'Geometry and Measure', substrand: 'Time', code: '4Gt.04', objective: 'Find time intervals between different units: days, weeks, months and years; seconds, minutes and hours that do not bridge through 60.' },

  // Geometry and Measure — Geometrical reasoning, shapes and measurements (Stage 4)
  { stage: 4, strand: 'Geometry and Measure', substrand: 'Geometrical reasoning, shapes and measurements', code: '4Gg.01', objective: 'Investigate what shapes can be made if two or more shapes are combined, and analyse their properties, including reference to tessellation.' },
  { stage: 4, strand: 'Geometry and Measure', substrand: 'Geometrical reasoning, shapes and measurements', code: '4Gg.02', objective: 'Estimate and measure perimeter and area of 2D shapes, understanding that two areas can be added together to calculate the area of a compound shape.' },
  { stage: 4, strand: 'Geometry and Measure', substrand: 'Geometrical reasoning, shapes and measurements', code: '4Gg.03', objective: 'Draw rectangles and squares on square grids, and measure their perimeter and area. Derive and use formulae to calculate areas and perimeters of rectangles and squares.' },
  { stage: 4, strand: 'Geometry and Measure', substrand: 'Geometrical reasoning, shapes and measurements', code: '4Gg.04', objective: 'Estimate the area of irregular shapes on a square grid (whole and part squares).' },
  { stage: 4, strand: 'Geometry and Measure', substrand: 'Geometrical reasoning, shapes and measurements', code: '4Gg.05', objective: 'Identify 2D faces of 3D shapes, and describe their properties.' },
  { stage: 4, strand: 'Geometry and Measure', substrand: 'Geometrical reasoning, shapes and measurements', code: '4Gg.06', objective: 'Match nets to their corresponding 3D shapes.' },
  { stage: 4, strand: 'Geometry and Measure', substrand: 'Geometrical reasoning, shapes and measurements', code: '4Gg.07', objective: 'Identify all horizontal, vertical and diagonal lines of symmetry on 2D shapes and patterns.' },
  { stage: 4, strand: 'Geometry and Measure', substrand: 'Geometrical reasoning, shapes and measurements', code: '4Gg.08', objective: 'Estimate, compare and classify angles, using geometric vocabulary including acute, right and obtuse.' },
  { stage: 4, strand: 'Geometry and Measure', substrand: 'Geometrical reasoning, shapes and measurements', code: '4Gg.09', objective: 'Use knowledge of fractions to read and interpret a measuring scale.' },

  // Geometry and Measure — Position and transformation (Stage 4)
  { stage: 4, strand: 'Geometry and Measure', substrand: 'Position and transformation', code: '4Gp.01', objective: 'Interpret and create descriptions of position, direction and movement, including reference to cardinal and ordinal points, and their notations.' },
  { stage: 4, strand: 'Geometry and Measure', substrand: 'Position and transformation', code: '4Gp.02', objective: 'Understand that position can be described using coordinate notation. Read and plot coordinates in the first quadrant (with the aid of a grid).' },
  { stage: 4, strand: 'Geometry and Measure', substrand: 'Position and transformation', code: '4Gp.03', objective: 'Reflect 2D shapes in a horizontal or vertical mirror line, including where the mirror line is the edge of the shape, on square grids.' },

  // Statistics and Probability — Statistics (Stage 4)
  { stage: 4, strand: 'Statistics and Probability', substrand: 'Statistics', code: '4Ss.01', objective: 'Plan and conduct an investigation to answer statistical questions, considering what data to collect (categorical and discrete data).' },
  { stage: 4, strand: 'Statistics and Probability', substrand: 'Statistics', code: '4Ss.02', objective: 'Record, organise and represent categorical and discrete data. Choose and explain which representation to use in a given situation: Venn and Carroll diagrams; tally charts and frequency tables; pictograms and bar charts; dot plots (one dot per count).' },
  { stage: 4, strand: 'Statistics and Probability', substrand: 'Statistics', code: '4Ss.03', objective: 'Interpret data, identifying similarities and variations, within and between data sets, to answer statistical questions. Discuss conclusions, considering the sources of variation.' },

  // Statistics and Probability — Probability (Stage 4)
  { stage: 4, strand: 'Statistics and Probability', substrand: 'Probability', code: '4Sp.01', objective: 'Use language associated with chance to describe familiar events, including reference to maybe, likely, certain, impossible.' },
  { stage: 4, strand: 'Statistics and Probability', substrand: 'Probability', code: '4Sp.02', objective: 'Conduct chance experiments, using small and large numbers of trials, and present and describe the results using the language of probability.' },

  // ─────────────────────────────────────────────
  // STAGE 5
  // ─────────────────────────────────────────────

  // Number — Counting and sequences (Stage 5)
  { stage: 5, strand: 'Number', substrand: 'Counting and sequences', code: '5Nc.01', objective: 'Count on and count back in steps of constant size, and extend beyond zero to include negative numbers.' },
  { stage: 5, strand: 'Number', substrand: 'Counting and sequences', code: '5Nc.02', objective: 'Recognise the use of objects, shapes or symbols to represent two unknown quantities in addition and subtraction calculations.' },
  { stage: 5, strand: 'Number', substrand: 'Counting and sequences', code: '5Nc.03', objective: 'Use the relationship between repeated addition of a constant and multiplication to find any term of a linear sequence.' },
  { stage: 5, strand: 'Number', substrand: 'Counting and sequences', code: '5Nc.04', objective: 'Recognise and extend the spatial pattern of square and triangular numbers.' },

  // Number — Integers and powers (Stage 5)
  { stage: 5, strand: 'Number', substrand: 'Integers and powers', code: '5Ni.01', objective: 'Estimate, add and subtract integers, including where one integer is negative.' },
  { stage: 5, strand: 'Number', substrand: 'Integers and powers', code: '5Ni.02', objective: 'Understand which law of arithmetic to apply to simplify calculations.' },
  { stage: 5, strand: 'Number', substrand: 'Integers and powers', code: '5Ni.03', objective: 'Understand that the four operations follow a particular order.' },
  { stage: 5, strand: 'Number', substrand: 'Integers and powers', code: '5Ni.04', objective: 'Estimate and multiply whole numbers up to 1000 by 1-digit or 2-digit whole numbers.' },
  { stage: 5, strand: 'Number', substrand: 'Integers and powers', code: '5Ni.05', objective: 'Estimate and divide whole numbers up to 1000 by 1-digit whole numbers.' },
  { stage: 5, strand: 'Number', substrand: 'Integers and powers', code: '5Ni.06', objective: 'Understand and explain the difference between prime and composite numbers.' },
  { stage: 5, strand: 'Number', substrand: 'Integers and powers', code: '5Ni.07', objective: 'Use knowledge of factors and multiples to understand tests of divisibility by 4 and 8.' },
  { stage: 5, strand: 'Number', substrand: 'Integers and powers', code: '5Ni.08', objective: 'Use knowledge of multiplication to recognise square numbers (from 1 to 100).' },

  // Number — Place value, ordering and rounding (Stage 5)
  { stage: 5, strand: 'Number', substrand: 'Place value, ordering and rounding', code: '5Np.01', objective: 'Understand and explain the value of each digit in decimals (tenths and hundredths).' },
  { stage: 5, strand: 'Number', substrand: 'Place value, ordering and rounding', code: '5Np.02', objective: 'Use knowledge of place value to multiply and divide whole numbers by 10, 100 and 1000.' },
  { stage: 5, strand: 'Number', substrand: 'Place value, ordering and rounding', code: '5Np.03', objective: 'Use knowledge of place value to multiply and divide decimals by 10 and 100.' },
  { stage: 5, strand: 'Number', substrand: 'Place value, ordering and rounding', code: '5Np.04', objective: 'Compose, decompose and regroup numbers, including decimals (tenths and hundredths).' },
  { stage: 5, strand: 'Number', substrand: 'Place value, ordering and rounding', code: '5Np.05', objective: 'Round numbers with one decimal place to the nearest whole number.' },

  // Number — Fractions, decimals, percentages, ratio and proportion (Stage 5)
  { stage: 5, strand: 'Number', substrand: 'Fractions, decimals, percentages, ratio and proportion', code: '5Nf.01', objective: 'Understand that a fraction can be represented as a division of the numerator by the denominator (unit fractions, three-quarters, tenths and hundredths).' },
  { stage: 5, strand: 'Number', substrand: 'Fractions, decimals, percentages, ratio and proportion', code: '5Nf.02', objective: 'Understand that proper fractions can act as operators.' },
  { stage: 5, strand: 'Number', substrand: 'Fractions, decimals, percentages, ratio and proportion', code: '5Nf.03', objective: 'Recognise that improper fractions and mixed numbers can have an equivalent value.' },
  { stage: 5, strand: 'Number', substrand: 'Fractions, decimals, percentages, ratio and proportion', code: '5Nf.04', objective: 'Recognise that proper fractions, decimals (one decimal place) and percentages can have equivalent values.' },
  { stage: 5, strand: 'Number', substrand: 'Fractions, decimals, percentages, ratio and proportion', code: '5Nf.05', objective: 'Estimate, add and subtract fractions with the same denominator and denominators that are multiples of each other.' },
  { stage: 5, strand: 'Number', substrand: 'Fractions, decimals, percentages, ratio and proportion', code: '5Nf.06', objective: 'Estimate, multiply and divide unit fractions by a whole number.' },
  { stage: 5, strand: 'Number', substrand: 'Fractions, decimals, percentages, ratio and proportion', code: '5Nf.07', objective: 'Recognise percentages of shapes, and write percentages as a fraction with denominator 100.' },
  { stage: 5, strand: 'Number', substrand: 'Fractions, decimals, percentages, ratio and proportion', code: '5Nf.08', objective: 'Understand the relative size of quantities to compare and order numbers with one decimal place, proper fractions with the same denominator and percentages, using the symbols =, > and <.' },
  { stage: 5, strand: 'Number', substrand: 'Fractions, decimals, percentages, ratio and proportion', code: '5Nf.09', objective: 'Estimate, add and subtract numbers with the same number of decimal places.' },
  { stage: 5, strand: 'Number', substrand: 'Fractions, decimals, percentages, ratio and proportion', code: '5Nf.10', objective: 'Estimate and multiply numbers with one decimal place by 1-digit whole numbers.' },
  { stage: 5, strand: 'Number', substrand: 'Fractions, decimals, percentages, ratio and proportion', code: '5Nf.11', objective: 'Understand that: a proportion compares part to whole; a ratio compares part to part of two or more quantities.' },

  // Geometry and Measure — Time (Stage 5)
  { stage: 5, strand: 'Geometry and Measure', substrand: 'Time', code: '5Gt.01', objective: 'Understand time intervals less than one second.' },
  { stage: 5, strand: 'Geometry and Measure', substrand: 'Time', code: '5Gt.02', objective: 'Compare times between time zones in digital notation (12- and 24-hour) and on analogue clocks.' },
  { stage: 5, strand: 'Geometry and Measure', substrand: 'Time', code: '5Gt.03', objective: 'Find time intervals in seconds, minutes and hours that bridge through 60.' },
  { stage: 5, strand: 'Geometry and Measure', substrand: 'Time', code: '5Gt.04', objective: 'Recognise that a time interval can be expressed as a decimal, or in mixed units.' },

  // Geometry and Measure — Geometrical reasoning, shapes and measurements (Stage 5)
  { stage: 5, strand: 'Geometry and Measure', substrand: 'Geometrical reasoning, shapes and measurements', code: '5Gg.01', objective: 'Identify, describe, classify and sketch isosceles, equilateral or scalene triangles, including reference to angles and symmetrical properties.' },
  { stage: 5, strand: 'Geometry and Measure', substrand: 'Geometrical reasoning, shapes and measurements', code: '5Gg.02', objective: 'Estimate and measure perimeter and area of 2D shapes, understanding that shapes with the same perimeter can have different areas and vice versa.' },
  { stage: 5, strand: 'Geometry and Measure', substrand: 'Geometrical reasoning, shapes and measurements', code: '5Gg.03', objective: 'Draw compound shapes that can be divided into rectangles and squares. Estimate, measure and calculate their perimeter and area.' },
  { stage: 5, strand: 'Geometry and Measure', substrand: 'Geometrical reasoning, shapes and measurements', code: '5Gg.04', objective: 'Identify, describe and sketch 3D shapes in different orientations.' },
  { stage: 5, strand: 'Geometry and Measure', substrand: 'Geometrical reasoning, shapes and measurements', code: '5Gg.05', objective: 'Identify and sketch different nets for a cube.' },
  { stage: 5, strand: 'Geometry and Measure', substrand: 'Geometrical reasoning, shapes and measurements', code: '5Gg.06', objective: 'Use knowledge of reflective symmetry to identify and complete symmetrical patterns.' },
  { stage: 5, strand: 'Geometry and Measure', substrand: 'Geometrical reasoning, shapes and measurements', code: '5Gg.07', objective: 'Estimate, compare and classify angles, using geometric vocabulary including acute, right, obtuse and reflex.' },
  { stage: 5, strand: 'Geometry and Measure', substrand: 'Geometrical reasoning, shapes and measurements', code: '5Gg.08', objective: 'Know that the sum of the angles on a straight line is 180°, and use this to calculate missing angles on a straight line.' },

  // Geometry and Measure — Position and transformation (Stage 5)
  { stage: 5, strand: 'Geometry and Measure', substrand: 'Position and transformation', code: '5Gp.01', objective: 'Compare the relative position of coordinates (with or without the aid of a grid).' },
  { stage: 5, strand: 'Geometry and Measure', substrand: 'Position and transformation', code: '5Gp.02', objective: 'Use knowledge of 2D shapes and coordinates to plot points to form lines and shapes in the first quadrant (with the aid of a grid).' },
  { stage: 5, strand: 'Geometry and Measure', substrand: 'Position and transformation', code: '5Gp.03', objective: 'Translate 2D shapes, identifying the corresponding points between the original and the translated image, on square grids.' },
  { stage: 5, strand: 'Geometry and Measure', substrand: 'Position and transformation', code: '5Gp.04', objective: 'Reflect 2D shapes in both horizontal and vertical mirror lines to create patterns on square grids.' },

  // Statistics and Probability — Statistics (Stage 5)
  { stage: 5, strand: 'Statistics and Probability', substrand: 'Statistics', code: '5Ss.01', objective: 'Plan and conduct an investigation to answer a set of related statistical questions, considering what data to collect (categorical, discrete and continuous data).' },
  { stage: 5, strand: 'Statistics and Probability', substrand: 'Statistics', code: '5Ss.02', objective: 'Record, organise and represent categorical, discrete and continuous data. Choose and explain which representation to use in a given situation: Venn and Carroll diagrams; tally charts and frequency tables; bar charts; waffle diagrams; frequency diagrams for continuous data; line graphs; dot plots (one dot per data point).' },
  { stage: 5, strand: 'Statistics and Probability', substrand: 'Statistics', code: '5Ss.03', objective: 'Understand that the mode and median are ways to describe and summarise data sets. Find and interpret the mode and the median, and consider their appropriateness for the context.' },
  { stage: 5, strand: 'Statistics and Probability', substrand: 'Statistics', code: '5Ss.04', objective: 'Interpret data, identifying patterns, within and between data sets, to answer statistical questions. Discuss conclusions, considering the sources of variation.' },

  // Statistics and Probability — Probability (Stage 5)
  { stage: 5, strand: 'Statistics and Probability', substrand: 'Probability', code: '5Sp.01', objective: 'Use the language associated with likelihood to describe and compare likelihood and risk of familiar events, including those with equally likely outcomes.' },
  { stage: 5, strand: 'Statistics and Probability', substrand: 'Probability', code: '5Sp.02', objective: 'Recognise that some outcomes are equally likely to happen and some outcomes are more (or less) likely to happen, when doing practical activities.' },
  { stage: 5, strand: 'Statistics and Probability', substrand: 'Probability', code: '5Sp.03', objective: 'Conduct chance experiments or simulations, using small and large numbers of trials, and present and describe the results using the language of probability.' },

  // ─────────────────────────────────────────────
  // STAGE 6
  // ─────────────────────────────────────────────

  // Number — Counting and sequences (Stage 6)
  { stage: 6, strand: 'Number', substrand: 'Counting and sequences', code: '6Nc.01', objective: 'Count on and count back in steps of constant size, including fractions and decimals, and extend beyond zero to include negative numbers.' },
  { stage: 6, strand: 'Number', substrand: 'Counting and sequences', code: '6Nc.02', objective: 'Recognise the use of letters to represent quantities that vary in addition and subtraction calculations.' },
  { stage: 6, strand: 'Number', substrand: 'Counting and sequences', code: '6Nc.03', objective: 'Use the relationship between repeated addition of a constant and multiplication to find and use a position-to-term rule.' },
  { stage: 6, strand: 'Number', substrand: 'Counting and sequences', code: '6Nc.04', objective: 'Use knowledge of square numbers to generate terms in a sequence, given its position.' },

  // Number — Integers and powers (Stage 6)
  { stage: 6, strand: 'Number', substrand: 'Integers and powers', code: '6Ni.01', objective: 'Estimate, add and subtract integers.' },
  { stage: 6, strand: 'Number', substrand: 'Integers and powers', code: '6Ni.02', objective: 'Use knowledge of laws of arithmetic and order of operations to simplify calculations.' },
  { stage: 6, strand: 'Number', substrand: 'Integers and powers', code: '6Ni.03', objective: 'Understand that brackets can be used to alter the order of operations.' },
  { stage: 6, strand: 'Number', substrand: 'Integers and powers', code: '6Ni.04', objective: 'Estimate and multiply whole numbers up to 10 000 by 1-digit or 2-digit whole numbers.' },
  { stage: 6, strand: 'Number', substrand: 'Integers and powers', code: '6Ni.05', objective: 'Estimate and divide whole numbers up to 1000 by 1-digit or 2-digit whole numbers.' },
  { stage: 6, strand: 'Number', substrand: 'Integers and powers', code: '6Ni.06', objective: 'Understand common multiples and common factors.' },
  { stage: 6, strand: 'Number', substrand: 'Integers and powers', code: '6Ni.07', objective: 'Use knowledge of factors and multiples to understand tests of divisibility by 3, 6 and 9.' },
  { stage: 6, strand: 'Number', substrand: 'Integers and powers', code: '6Ni.08', objective: 'Use knowledge of multiplication and square numbers to recognise cube numbers (from 1 to 125).' },

  // Number — Place value, ordering and rounding (Stage 6)
  { stage: 6, strand: 'Number', substrand: 'Place value, ordering and rounding', code: '6Np.01', objective: 'Understand and explain the value of each digit in decimals (tenths, hundredths and thousandths).' },
  { stage: 6, strand: 'Number', substrand: 'Place value, ordering and rounding', code: '6Np.02', objective: 'Use knowledge of place value to multiply and divide whole numbers and decimals by 10, 100 and 1000.' },
  { stage: 6, strand: 'Number', substrand: 'Place value, ordering and rounding', code: '6Np.03', objective: 'Compose, decompose and regroup numbers, including decimals (tenths, hundredths and thousandths).' },
  { stage: 6, strand: 'Number', substrand: 'Place value, ordering and rounding', code: '6Np.04', objective: 'Round numbers with two decimal places to the nearest tenth or whole number.' },

  // Number — Fractions, decimals, percentages, ratio and proportion (Stage 6)
  { stage: 6, strand: 'Number', substrand: 'Fractions, decimals, percentages, ratio and proportion', code: '6Nf.01', objective: 'Understand that a fraction can be represented as a division of the numerator by the denominator (proper and improper fractions).' },
  { stage: 6, strand: 'Number', substrand: 'Fractions, decimals, percentages, ratio and proportion', code: '6Nf.02', objective: 'Understand that proper and improper fractions can act as operators.' },
  { stage: 6, strand: 'Number', substrand: 'Fractions, decimals, percentages, ratio and proportion', code: '6Nf.03', objective: 'Use knowledge of equivalence to write fractions in their simplest form.' },
  { stage: 6, strand: 'Number', substrand: 'Fractions, decimals, percentages, ratio and proportion', code: '6Nf.04', objective: 'Recognise that fractions, decimals (one or two decimal places) and percentages can have equivalent values.' },
  { stage: 6, strand: 'Number', substrand: 'Fractions, decimals, percentages, ratio and proportion', code: '6Nf.05', objective: 'Estimate, add and subtract fractions with different denominators.' },
  { stage: 6, strand: 'Number', substrand: 'Fractions, decimals, percentages, ratio and proportion', code: '6Nf.06', objective: 'Estimate, multiply and divide proper fractions by whole numbers.' },
  { stage: 6, strand: 'Number', substrand: 'Fractions, decimals, percentages, ratio and proportion', code: '6Nf.07', objective: 'Recognise percentages (1%, and multiples of 5% up to 100%) of shapes and whole numbers.' },
  { stage: 6, strand: 'Number', substrand: 'Fractions, decimals, percentages, ratio and proportion', code: '6Nf.08', objective: 'Understand the relative size of quantities to compare and order numbers with one or two decimal places, proper fractions with different denominators and percentages, using the symbols =, > and <.' },
  { stage: 6, strand: 'Number', substrand: 'Fractions, decimals, percentages, ratio and proportion', code: '6Nf.09', objective: 'Estimate, add and subtract numbers with the same or different number of decimal places.' },
  { stage: 6, strand: 'Number', substrand: 'Fractions, decimals, percentages, ratio and proportion', code: '6Nf.10', objective: 'Estimate and multiply numbers with one or two decimal places by 1-digit and 2-digit whole numbers.' },
  { stage: 6, strand: 'Number', substrand: 'Fractions, decimals, percentages, ratio and proportion', code: '6Nf.11', objective: 'Estimate and divide numbers with one or two decimal places by whole numbers.' },
  { stage: 6, strand: 'Number', substrand: 'Fractions, decimals, percentages, ratio and proportion', code: '6Nf.12', objective: 'Understand the relationship between two quantities when they are in direct proportion.' },
  { stage: 6, strand: 'Number', substrand: 'Fractions, decimals, percentages, ratio and proportion', code: '6Nf.13', objective: 'Use knowledge of equivalence to understand and use equivalent ratios.' },

  // Geometry and Measure — Time (Stage 6)
  { stage: 6, strand: 'Geometry and Measure', substrand: 'Time', code: '6Gt.01', objective: 'Convert between time intervals expressed as a decimal and in mixed units.' },

  // Geometry and Measure — Geometrical reasoning, shapes and measurements (Stage 6)
  { stage: 6, strand: 'Geometry and Measure', substrand: 'Geometrical reasoning, shapes and measurements', code: '6Gg.01', objective: 'Identify, describe, classify and sketch quadrilaterals, including reference to angles, symmetrical properties, parallel sides and diagonals.' },
  { stage: 6, strand: 'Geometry and Measure', substrand: 'Geometrical reasoning, shapes and measurements', code: '6Gg.02', objective: 'Know the parts of a circle: centre; radius; diameter; circumference.' },
  { stage: 6, strand: 'Geometry and Measure', substrand: 'Geometrical reasoning, shapes and measurements', code: '6Gg.03', objective: 'Use knowledge of area of rectangles to estimate and calculate the area of right-angled triangles.' },
  { stage: 6, strand: 'Geometry and Measure', substrand: 'Geometrical reasoning, shapes and measurements', code: '6Gg.04', objective: 'Identify, describe and sketch compound 3D shapes.' },
  { stage: 6, strand: 'Geometry and Measure', substrand: 'Geometrical reasoning, shapes and measurements', code: '6Gg.05', objective: 'Understand the difference between capacity and volume.' },
  { stage: 6, strand: 'Geometry and Measure', substrand: 'Geometrical reasoning, shapes and measurements', code: '6Gg.06', objective: 'Identify and sketch different nets for cubes, cuboids, prisms and pyramids.' },
  { stage: 6, strand: 'Geometry and Measure', substrand: 'Geometrical reasoning, shapes and measurements', code: '6Gg.07', objective: 'Understand the relationship between area of 2D shapes and surface area of 3D shapes.' },
  { stage: 6, strand: 'Geometry and Measure', substrand: 'Geometrical reasoning, shapes and measurements', code: '6Gg.08', objective: 'Identify rotational symmetry in familiar shapes, patterns or images with maximum order 4. Describe rotational symmetry as "order x".' },
  { stage: 6, strand: 'Geometry and Measure', substrand: 'Geometrical reasoning, shapes and measurements', code: '6Gg.09', objective: 'Classify, estimate, measure and draw angles.' },
  { stage: 6, strand: 'Geometry and Measure', substrand: 'Geometrical reasoning, shapes and measurements', code: '6Gg.10', objective: 'Know that the sum of the angles in a triangle is 180°, and use this to calculate missing angles in a triangle.' },
  { stage: 6, strand: 'Geometry and Measure', substrand: 'Geometrical reasoning, shapes and measurements', code: '6Gg.11', objective: 'Construct circles of a specified radius or diameter.' },

  // Geometry and Measure — Position and transformation (Stage 6)
  { stage: 6, strand: 'Geometry and Measure', substrand: 'Position and transformation', code: '6Gp.01', objective: 'Read and plot coordinates including integers, fractions and decimals, in all four quadrants (with the aid of a grid).' },
  { stage: 6, strand: 'Geometry and Measure', substrand: 'Position and transformation', code: '6Gp.02', objective: 'Use knowledge of 2D shapes and coordinates to plot points to form lines and shapes in all four quadrants.' },
  { stage: 6, strand: 'Geometry and Measure', substrand: 'Position and transformation', code: '6Gp.03', objective: 'Translate 2D shapes, identifying the corresponding points between the original and the translated image, on coordinate grids.' },
  { stage: 6, strand: 'Geometry and Measure', substrand: 'Position and transformation', code: '6Gp.04', objective: 'Reflect 2D shapes in a given mirror line (vertical, horizontal and diagonal), on square grids.' },
  { stage: 6, strand: 'Geometry and Measure', substrand: 'Position and transformation', code: '6Gp.05', objective: 'Rotate shapes 90° around a vertex (clockwise or anticlockwise).' },

  // Statistics and Probability — Statistics (Stage 6)
  { stage: 6, strand: 'Statistics and Probability', substrand: 'Statistics', code: '6Ss.01', objective: 'Plan and conduct an investigation and make predictions for a set of related statistical questions, considering what data to collect (categorical, discrete and continuous data).' },
  { stage: 6, strand: 'Statistics and Probability', substrand: 'Statistics', code: '6Ss.02', objective: 'Record, organise and represent categorical, discrete and continuous data. Choose and explain which representation to use in a given situation: Venn and Carroll diagrams; tally charts and frequency tables; bar charts; waffle diagrams and pie charts; frequency diagrams for continuous data; line graphs; scatter graphs; dot plots.' },
  { stage: 6, strand: 'Statistics and Probability', substrand: 'Statistics', code: '6Ss.03', objective: 'Understand that the mode, median, mean and range are ways to describe and summarise data sets. Find and interpret the mode (including bimodal data), median, mean and range, and consider their appropriateness for the context.' },
  { stage: 6, strand: 'Statistics and Probability', substrand: 'Statistics', code: '6Ss.04', objective: 'Interpret data, identifying patterns, within and between data sets, to answer statistical questions. Discuss conclusions, considering the sources of variation, and check predictions.' },

  // Statistics and Probability — Probability (Stage 6)
  { stage: 6, strand: 'Statistics and Probability', substrand: 'Probability', code: '6Sp.01', objective: 'Use the language associated with probability and proportion to describe and compare possible outcomes.' },
  { stage: 6, strand: 'Statistics and Probability', substrand: 'Probability', code: '6Sp.02', objective: 'Identify when two events can happen at the same time and when they cannot, and know that the latter are called "mutually exclusive".' },
  { stage: 6, strand: 'Statistics and Probability', substrand: 'Probability', code: '6Sp.03', objective: 'Recognise that some probabilities can only be modelled through experiments using a large number of trials.' },
  { stage: 6, strand: 'Statistics and Probability', substrand: 'Probability', code: '6Sp.04', objective: 'Conduct chance experiments or simulations, using small and large numbers of trials. Predict, analyse and describe the frequency of outcomes using the language of probability.' },
];

async function seed() {
  const client = await pool.connect();
  try {
    console.log(`🔢 Starting Cambridge Primary Mathematics seed...`);
    console.log(`📚 Total objectives to insert: ${objectives.length}`);

    // Optional: clear existing Math entries to avoid duplicates on re-run
    await client.query(
      `DELETE FROM curriculum WHERE subject = 'Mathematics' AND curriculum_type = 'Cambridge Primary'`
    );
    console.log('🗑️  Cleared existing Mathematics curriculum entries.');

    let inserted = 0;
    for (const obj of objectives) {
      await client.query(
        `INSERT INTO curriculum
          (subject, grade, stage, strand, substrand, code, objective, curriculum_type)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          'Mathematics',
          obj.stage,       // grade = stage number (1-6)
          obj.stage,       // stage column
          obj.strand,
          obj.substrand,
          obj.code,
          obj.objective,
          'Cambridge Primary'
        ]
      );
      inserted++;
      if (inserted % 20 === 0) {
        console.log(`  ✅ Inserted ${inserted}/${objectives.length} objectives...`);
      }
    }

    console.log(`\n🎉 Done! Inserted ${inserted} Cambridge Primary Mathematics objectives.`);
    console.log('\n📊 Breakdown by Stage:');
    for (let s = 1; s <= 6; s++) {
      const count = objectives.filter(o => o.stage === s).length;
      console.log(`   Stage ${s}: ${count} objectives`);
    }
    console.log('\n📦 Breakdown by Strand:');
    const strands = [...new Set(objectives.map(o => o.strand))];
    for (const strand of strands) {
      const count = objectives.filter(o => o.strand === strand).length;
      console.log(`   ${strand}: ${count} objectives`);
    }

  } catch (err) {
    console.error('❌ Seed error:', err.message);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

seed();
