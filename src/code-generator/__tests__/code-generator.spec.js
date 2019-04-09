import CodeGenerator from '../CodeGenerator'

describe('code-generator', () => {
  test('it should generate nothing when there are no events', () => {
    const events = []
    const codeGenerator = new CodeGenerator()
    expect(codeGenerator._parseEvents(events)).toBeFalsy()
  })

  test('it generates a page.select() only for select dropdowns', () => {
    const events = [{ action: 'change', selector: 'select#animals', tagName: 'SELECT', value: 'hamster' }]
    const codeGenerator = new CodeGenerator()
    expect(codeGenerator._parseEvents(events)).toContain("cy.get('select#animals').select('hamster')")
  })

  test('it uses the default page frame when events originate from frame 0', () => {
    const events = [{ action: 'click', selector: 'a.link', frameId: 0, frameUrl: 'https://some.site.com' }]
    const codeGenerator = new CodeGenerator()
    const result = codeGenerator._parseEvents(events)
    expect(result).toContain("cy.get('a.link').click()")
  })

})
