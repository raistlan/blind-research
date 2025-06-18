import type { NextApiRequest, NextApiResponse } from 'next';

type Data = {
  fixedCss: string;
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<Data>
) {
  if (req.method !== 'POST') {
    res.status(405).end();
    return;
  }

  const { css } = req.body;
  if (!css) {
    res.status(400).json({ fixedCss: '' });
    return;
  }

  // Call OpenAI API here with your CSS & color blindness prompt
  // Example using openai npm package:

  import OpenAI from 'openai';
  const openai = new OpenAI();

  const prompt = `Modify the following CSS to be accessible for red-green color blindness:\n\n${css}`;

  const completion = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [{ role: 'user', content: prompt }],
  });

  const fixedCss = completion.choices[0].message?.content || '';

  res.status(200).json({ fixedCss });
}
