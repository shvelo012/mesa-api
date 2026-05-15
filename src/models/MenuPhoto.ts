import {
  Table,
  Column,
  Model,
  DataType,
  BelongsTo,
  ForeignKey,
  PrimaryKey,
  Default,
  CreatedAt,
  UpdatedAt,
} from "sequelize-typescript";
import { Menu } from "./Menu";

@Table({ tableName: "menu_photos" })
export class MenuPhoto extends Model {
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column(DataType.UUID)
  declare id: string;

  @ForeignKey(() => Menu)
  @Column(DataType.UUID)
  declare menuId: string;

  @BelongsTo(() => Menu)
  declare menu: Menu;

  @Column(DataType.STRING)
  declare url: string;

  @Default(0)
  @Column(DataType.INTEGER)
  declare order: number;

  @CreatedAt
  declare createdAt: Date;

  @UpdatedAt
  declare updatedAt: Date;
}
