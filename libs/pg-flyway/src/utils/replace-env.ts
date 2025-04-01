export function replaceEnv(command: string | undefined, envReplacerKeyPattern = '$key', depth = 10): string {
  if (!command) {
    return command || '';
  }
  let newCommand = command;
  Object.keys(process.env).forEach(
    (key) =>
      (newCommand = (newCommand || '')
        .split('%space%')
        .join(' ')
        .split('%br%')
        .join('<br/>')
        .split(`\${${key}}`)
        .join(process.env[key])
        .split(envReplacerKeyPattern.replace('key', key))
        .join(process.env[key]))
  );
  if (command !== newCommand && newCommand.includes('$') && depth > 0) {
    newCommand = replaceEnv(newCommand, envReplacerKeyPattern, depth - 1);
  }
  return newCommand || '';
}
