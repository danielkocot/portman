/**
 * Method to render a safe, chained path notation
 * @param path the path definition (example: website[0].url)
 */
export const renderChainPath = (path: string): string => {
  // eslint-disable-next-line no-useless-escape
  return path.replace(/\./g, '?.').replace(/[\[']+/g, '?.[')
}
