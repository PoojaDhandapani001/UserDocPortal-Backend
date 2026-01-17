const getNameFromEmail = (email) => {
  if (!email) return "";

  // take part before @
  const localPart = email.split("@")[0];

  // replace dots, underscores, hyphens with spaces
  const name = localPart.replace(/[._-]+/g, " ");

  // capitalize first letter of each word
  return name
    .split(" ")
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}




export { getNameFromEmail };