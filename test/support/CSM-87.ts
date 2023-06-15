describe('CSM-87', async function () {
  it('An hcp should be able to load his key with `loadKeyPairsAsJwkInBrowserLocalStorage` and then create shamir partitions for himself', async function () {
    // This test does not apply to v7 or higher: it was a bug related to a specific method
    this.skip()
  })
})
