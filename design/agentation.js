// Agentation (agentation.com): a feedback toolbar, bottom right. Click it, click any element (or drag over an
// area, or select text), write a note, add as many as you like, then Copy: the notes come out as markdown with
// each element's selector and position, ready to paste to the agent. It's a React component, so React and the
// toolbar load from esm.sh; the page works the same if they can't load. Not part of the design system.
const V = { agentation: '3.1.2', react: '18.3.1' };
const deps = `deps=react@${V.react},react-dom@${V.react}`;

Promise.all([
  import(`https://esm.sh/react@${V.react}`),
  import(`https://esm.sh/react-dom@${V.react}/client?${deps}`),
  import(`https://esm.sh/agentation@${V.agentation}?${deps}`),
]).then(([React, { createRoot }, { Agentation }]) => {
  const host = document.createElement('div');
  host.id = 'agentation';
  document.body.append(host);
  createRoot(host).render(React.createElement(Agentation, { appName: `Selvedge design: ${document.title}` }));
}).catch(() => {});
